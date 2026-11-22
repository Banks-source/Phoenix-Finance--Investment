import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildBulkUpdate, BulkPatch } from "@/lib/bulkEdit";
import { fetchTransactionIds, TxnFilter } from "@/lib/queries";
import { learnPayees, applyRulesToPending, RuleSource } from "@/lib/payeeMemory";

type Supa = ReturnType<typeof createServiceClient>;

// PostgREST rejects very long `in (...)` lists, so work in chunks.
const CHUNK = 200;

async function rowsFor(supabase: Supa, ids: string[]) {
  const out: { merchant: string | null; detail: string | null; category: string | null; sub_category: string | null }[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await supabase.from("transactions").select("merchant,detail,category,sub_category").in("id", ids.slice(i, i + CHUNK));
    out.push(...(data ?? []));
  }
  return out;
}

// Transaction edit endpoint (service-role, server-only). Every edit view uses it.
//   Target:  { id } | { ids } | { filter }   (filter = everything matching a list view's filters)
//   Change:  any of category, sub_category, owner, status — see lib/bulkEdit.ts.
//   Approve: no change fields, and no keepStatus  → approves as-is.
// Every category / sub-category edit is remembered per payee (lib/payeeMemory.ts)
// and applied to the other unreviewed transactions from that payee; approving a
// few rows as-is is remembered as a confirmation.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as BulkPatch & { id?: string; ids?: string[]; filter?: TxnFilter };
  const supabase = createServiceClient();

  let ids: string[];
  if (body.ids?.length) ids = body.ids;
  else if (body.id) ids = [body.id];
  else if (body.filter) ids = await fetchTransactionIds(body.filter);
  else return NextResponse.json({ error: "id, ids or filter required" }, { status: 400 });

  const built = buildBulkUpdate(body);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });

  // Choosing a category yourself replaces any Claude suggestion on the row.
  const fullUpdate = built.update.category ? { ...built.update, categorised_by: null } : built.update;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    let { error } = await supabase.from("transactions").update(fullUpdate).in("id", chunk);
    if (error && (error.code === "42703" || error.code === "PGRST204")) {
      ({ error } = await supabase.from("transactions").update(built.update).in("id", chunk)); // migration 0027 not applied yet
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Learning is best-effort: a failure here must never undo or hide the edit itself.
  let learned = 0;
  let alsoUpdated = 0;
  try {
    const edited = body.category !== undefined || body.sub_category !== undefined;
    const confirmed = !edited && built.update.status === "approved" && !body.filter && ids.length <= CHUNK;
    if (edited || confirmed) {
      const source: RuleSource = edited ? "user" : "confirmed";
      const written = await learnPayees(await rowsFor(supabase, ids), source, supabase);
      learned = written.length;
      if (source === "user") alsoUpdated = await applyRulesToPending(written, new Set(ids), supabase);
    }
  } catch (e) {
    console.error("learning failed", e);
  }
  return NextResponse.json({ ok: true, updated: ids.length, learned, alsoUpdated });
}
