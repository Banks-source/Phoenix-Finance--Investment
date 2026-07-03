import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveType } from "@/lib/taxonomy";
import { normalizeMerchant } from "@/lib/categorise";

type Supa = ReturnType<typeof createServiceClient>;

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
  const { data: txns } = await supabase.from("transactions").select("merchant").in("id", ids);
  const patterns = new Set<string>();
  for (const t of txns ?? []) {
    const p = normalizeMerchant((t as { merchant: string | null }).merchant ?? "");
    if (p.length >= 3) patterns.add(p);
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

// Transaction review + edit endpoint (service-role, server-only).
//   - Approve one:      { id, category?, sub_category? }
//   - Edit category:    { id, category, sub_category?, keepStatus: true }
//   - Bulk approve:     { ids: string[] }                      (approve as-is)
//   - Bulk categorise:  { ids: string[], category, sub_category?, keepStatus? }
//   - Undo / revert:    { ids: string[], status: "pending_review" }
// Category changes recompute `type` from the taxonomy and are remembered as
// merchant_rules so the same merchant is auto-categorised on the next import.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    id?: string;
    ids?: string[];
    category?: string;
    sub_category?: string | null;
    keepStatus?: boolean;
    status?: "pending_review" | "approved";
  };
  const supabase = createServiceClient();

  // Bulk operations on multiple ids.
  if (body.ids?.length) {
    const update: Record<string, unknown> = {};
    let learnedType: string | undefined;
    if (body.category) {
      learnedType = resolveType(body.category, body.sub_category ?? undefined);
      update.category = body.category;
      update.sub_category = body.sub_category ?? null;
      update.type = learnedType;
    } else if (body.sub_category !== undefined) {
      // Sub-category-only edit: keep the existing category/type.
      update.sub_category = body.sub_category;
    }
    if (body.status) update.status = body.status;
    else if (!body.keepStatus) update.status = "approved";
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }
    const { error } = await supabase.from("transactions").update(update).in("id", body.ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (body.category && learnedType) {
      await learnMerchantRules(supabase, body.ids, body.category, body.sub_category ?? null, learnedType);
    }
    return NextResponse.json({ ok: true, updated: body.ids.length });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id or ids required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  let learnedType: string | undefined;
  if (body.category) {
    learnedType = resolveType(body.category, body.sub_category ?? undefined);
    update.category = body.category;
    update.sub_category = body.sub_category ?? null;
    update.type = learnedType;
  } else if (body.sub_category !== undefined) {
    // Sub-category-only edit: keep the existing category/type.
    update.sub_category = body.sub_category;
  }
  if (body.status) update.status = body.status;
  else if (!body.keepStatus) update.status = "approved";

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { error } = await supabase.from("transactions").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (body.category && learnedType) {
    await learnMerchantRules(supabase, [body.id], body.category, body.sub_category ?? null, learnedType);
  }
  return NextResponse.json({ ok: true });
}
