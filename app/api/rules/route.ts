import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveType } from "@/lib/taxonomy";
import { applyRulesToPending } from "@/lib/payeeMemory";

// Edit or forget a remembered payee. Behind the normal login (middleware).

export async function PATCH(req: NextRequest) {
  const { id, category, sub_category } = (await req.json()) as { id?: string; category?: string; sub_category?: string | null };
  if (!id || !category) return NextResponse.json({ error: "id and category required" }, { status: 400 });
  const supabase = createServiceClient();
  const sub = sub_category?.trim() || null;
  const type = resolveType(category, sub);
  const { data, error } = await supabase
    .from("merchant_rules")
    .update({ category, sub_category: sub, type, source: "user", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("merchant_pattern")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const alsoUpdated = await applyRulesToPending([{ key: data.merchant_pattern, category, sub_category: sub, type }], new Set(), supabase);
  return NextResponse.json({ ok: true, alsoUpdated });
}

export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await createServiceClient().from("merchant_rules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
