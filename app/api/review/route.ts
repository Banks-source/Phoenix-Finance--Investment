import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildBulkUpdate, BulkPatch } from "@/lib/bulkEdit";
import { fetchTransactionIds, TxnFilter } from "@/lib/queries";
import { normalizeMerchant } from "@/lib/categorise";

type Supa = ReturnType<typeof createServiceClient>;

// PostgREST rejects very long `in (...)` lists, so work in chunks.
const CHUNK = 200;

// Remember a manual categorisation so future imports auto-apply it.
// Keyed on the (normalised) merchant of each affected row. Rows with no
// merchant are skipped — a rule on an empty/detail-only pattern is too noisy.
async function learnMerchantRules(
  supabase: Supa,
  ids: string[],
  category: string,
  sub_category: string | null,
  type: string
) {
  const patterns = new Set<string>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data: txns } = await supabase.from("transactions").select("merchant").in("id", ids.slice(i, i + CHUNK));
    for (const t of txns ?? []) {
      const p = normalizeMerchant((t as { merchant: string | null }).merchant ?? "");
      if (p.length >= 3) patterns.add(p);
    }
  }
  if (!patterns.size) return;

  const { data: existing } = await supabase
    .from("merchant_rules")
    .select("merchant_pattern, match_count")
    .in("merchant_pattern", [...patterns]);
  const counts = new Map((existing ?? []).map((r) => [r.merchant_pattern as string, r.match_count as number]));

  const nowIso = new Date().toISOString();
  const rows = [...patterns].map((merchant_pattern) => ({
    merchant_pattern,
    category,
    sub_category,
    type,
    match_count: (counts.get(merchant_pattern) ?? 0) + 1,
    last_used: nowIso,
  }));
  await supabase.from("merchant_rules").upsert(rows, { onConflict: "merchant_pattern" });
}

// Transaction edit endpoint (service-role, server-only). Every edit view uses it.
//   Target:  { id } | { ids } | { filter }   (filter = everything matching a list view's filters)
//   Change:  any of category, sub_category, owner, status — see lib/bulkEdit.ts.
//   Approve: no change fields, and no keepStatus  → approves as-is.
// Category changes recompute `type` from the taxonomy and are remembered as
// merchant_rules so the same merchant is auto-categorised on the next import.
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

  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabase.from("transactions").update(built.update).in("id", ids.slice(i, i + CHUNK));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (body.category && built.learnedType) {
    await learnMerchantRules(supabase, ids, body.category, body.sub_category ?? null, built.learnedType);
  }
  return NextResponse.json({ ok: true, updated: ids.length });
}
