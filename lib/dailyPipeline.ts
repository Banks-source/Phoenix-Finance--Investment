import { createServiceClient } from "@/lib/supabase/server";
import { categoriseSync } from "@/lib/categorise";
import { loadMerchantRules, pageAll } from "@/lib/payeeMemory";
import { payeeKey } from "@/lib/payeeKey";
import { runMovementEngine, MovementRunResult } from "@/lib/movementRun";
import { askClaude, PayeeQuestion } from "@/lib/claudeCategorise";
import { deriveConsolidatedSubCategory } from "@/lib/subCategoryConsolidation";
import { resolveType } from "@/lib/taxonomy";

type Supa = ReturnType<typeof createServiceClient>;

// The daily pass that runs after the bank sync. Everything it does is a
// *suggestion*: rows stay "to review", and they already count in budgets as
// unreviewed — so a mid-month view is useful before you've approved a thing.
//   1. money movement  — pair transfer legs, flag payments to unknown accounts
//   2. memory + rules  — place still-uncategorised rows using what you've taught it
//   3. Claude          — one question per remaining payee (never written to memory)

export interface DailyResult {
  movement: Pick<MovementRunResult, "changes" | "byKind" | "sentToReview">;
  placedByMemory: number;
  claude: { payeesAsked: number; rowsCategorised: number; skipped: string | null };
}

const CHUNK = 200;
const MOVEMENT_LOOKBACK_DAYS = 45;
const MAX_PAYEES_PER_RUN = 100;
const BATCH = 25;

type PendingRow = { id: string; merchant: string | null; detail: string | null; amount: number; category: string | null };

async function updateIds(supabase: Supa, ids: string[], update: Record<string, unknown>) {
  for (let i = 0; i < ids.length; i += CHUNK) {
    let { error } = await supabase.from("transactions").update(update).in("id", ids.slice(i, i + CHUNK));
    if (error && (error.code === "42703" || error.code === "PGRST204")) {
      const { categorised_by, ...rest } = update; // migration 0027 not applied yet
      ({ error } = await supabase.from("transactions").update(rest).in("id", ids.slice(i, i + CHUNK)));
    }
    if (error) throw new Error(error.message);
  }
}

async function uncategorisedPending(supabase: Supa): Promise<PendingRow[]> {
  return pageAll<PendingRow>(
    (s) =>
      s
        .from("transactions")
        .select("id,merchant,detail,amount,category")
        .eq("status", "pending_review")
        .or("category.is.null,category.eq.Uncategorised")
        .order("id"),
    supabase
  );
}

export async function runDailyPipeline(opts: { useClaude?: boolean } = {}, supabase: Supa = createServiceClient()): Promise<DailyResult> {
  // 1. money movement
  const since = new Date(Date.now() - MOVEMENT_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const mv = await runMovementEngine({ since, apply: true }, supabase);

  // 2. memory + built-in rules on rows still uncategorised
  const rules = await loadMerchantRules(supabase);
  let pending = await uncategorisedPending(supabase);
  const byPlacement = new Map<string, { update: Record<string, unknown>; ids: string[] }>();
  const unplaced: PendingRow[] = [];
  for (const t of pending) {
    const s = categoriseSync(t.merchant ?? t.detail ?? "", t.detail ?? "", rules);
    if (s.category === "Uncategorised") {
      unplaced.push(t);
      continue;
    }
    const update = { category: s.category, sub_category: s.sub_category, type: s.type, confidence: s.confidence };
    const k = JSON.stringify(update);
    (byPlacement.get(k) ?? byPlacement.set(k, { update, ids: [] }).get(k)!).ids.push(t.id);
  }
  let placedByMemory = 0;
  for (const { update, ids } of byPlacement.values()) {
    await updateIds(supabase, ids, update);
    placedByMemory += ids.length;
  }

  // 3. Claude, once per remaining payee
  const claude: DailyResult["claude"] = { payeesAsked: 0, rowsCategorised: 0, skipped: null };
  if (opts.useClaude === false) claude.skipped = "disabled";
  else if (!process.env.ANTHROPIC_API_KEY) claude.skipped = "no ANTHROPIC_API_KEY";
  else if (unplaced.length) {
    const byPayee = new Map<string, PendingRow[]>();
    for (const t of unplaced) {
      const key = payeeKey(t.merchant, t.detail) || `raw:${(t.detail ?? t.id).slice(0, 40)}`;
      (byPayee.get(key) ?? byPayee.set(key, []).get(key)!).push(t);
    }
    const payees = [...byPayee.values()].slice(0, MAX_PAYEES_PER_RUN);
    for (let i = 0; i < payees.length; i += BATCH) {
      const batch = payees.slice(i, i + BATCH);
      const questions: PayeeQuestion[] = batch.map((rows) => ({ merchant: rows[0].merchant, detail: rows[0].detail, amount: Number(rows[0].amount) }));
      const answers = await askClaude(questions);
      claude.payeesAsked += batch.length;
      for (const [idx, ans] of answers) {
        const rows = batch[idx];
        const sub = deriveConsolidatedSubCategory(ans.category, rows[0].merchant, rows[0].detail);
        await updateIds(
          supabase,
          rows.map((r) => r.id),
          { category: ans.category, sub_category: sub, type: resolveType(ans.category, sub), confidence: ans.confidence, categorised_by: "claude" }
        );
        claude.rowsCategorised += rows.length;
      }
    }
  }

  return {
    movement: { changes: mv.changes, byKind: mv.byKind, sentToReview: mv.sentToReview },
    placedByMemory,
    claude,
  };
}
