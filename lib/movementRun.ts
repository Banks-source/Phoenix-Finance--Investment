import { createServiceClient } from "@/lib/supabase/server";
import { pageAll } from "@/lib/payeeMemory";
import { planMovement, MovementChange, MovementRow, PAIR_WINDOW_DAYS } from "@/lib/moneyMovement";
import { AccountRef } from "@/lib/transferAccounts";

type Supa = ReturnType<typeof createServiceClient>;

export interface MovementSample {
  id: string;
  date: string;
  amount: number;
  detail: string | null;
  from: string;
  to: string;
  kind: MovementChange["kind"];
  toReview: boolean;
}

export interface MovementRunResult {
  applied: boolean;
  since: string;
  scanned: number;
  changes: number;
  byKind: Record<string, number>;
  sentToReview: number;
  samples: MovementSample[];
}

const CHUNK = 200;

function daysBefore(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Run the money-movement engine over bank-linked transactions from `since`.
 * Dry run unless `apply`. Rows it moves out of a category you've approved go
 * back to Review with a reason; everything else is updated in place.
 */
export async function runMovementEngine(opts: { since: string; apply: boolean }, supabase: Supa = createServiceClient()): Promise<MovementRunResult> {
  const rows = (
    await pageAll<MovementRow>(
      (s) =>
        s
          .from("transactions")
          .select("id,account_id,date,amount,detail,merchant,category,sub_category,status")
          .gte("date", daysBefore(opts.since, PAIR_WINDOW_DAYS + 1))
          .not("account_id", "is", null)
          .order("id"),
      supabase
    )
  ).map((r) => ({ ...r, amount: Number(r.amount) }));
  const { data: accounts } = await supabase.from("accounts").select("id, institution, account_label, account_number_masked");

  const plan = planMovement(rows, (accounts ?? []) as AccountRef[], { since: opts.since });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const byKind: Record<string, number> = {};
  for (const c of plan) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;

  if (opts.apply) {
    const groups = new Map<string, { update: Record<string, unknown>; ids: string[] }>();
    for (const c of plan) {
      const update: Record<string, unknown> = { category: c.category, sub_category: c.sub_category, type: c.type };
      if (c.toReview) {
        update.status = "pending_review";
        update.review_reason = c.reason;
      }
      const k = JSON.stringify(update);
      (groups.get(k) ?? groups.set(k, { update, ids: [] }).get(k)!).ids.push(c.id);
    }
    for (const { update, ids } of groups.values()) {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        let { error } = await supabase.from("transactions").update(update).in("id", chunk);
        if (error && (error.code === "42703" || error.code === "PGRST204")) {
          const { review_reason, ...rest } = update; // migration 0022 not applied
          ({ error } = await supabase.from("transactions").update(rest).in("id", chunk));
        }
        if (error) throw new Error(error.message);
      }
    }
  }

  return {
    applied: opts.apply,
    since: opts.since,
    scanned: rows.length,
    changes: plan.length,
    byKind,
    sentToReview: plan.filter((c) => c.toReview).length,
    samples: plan.slice(0, 25).map((c) => {
      const r = byId.get(c.id)!;
      return {
        id: c.id,
        date: r.date,
        amount: r.amount,
        detail: r.detail,
        from: [r.category, r.sub_category].filter(Boolean).join(" › ") || "uncategorised",
        to: `${c.category} › ${c.sub_category}`,
        kind: c.kind,
        toReview: c.toReview,
      };
    }),
  };
}
