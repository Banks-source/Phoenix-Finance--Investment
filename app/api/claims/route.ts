import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { TAX_CATEGORY_BY_CODE } from "@/lib/taxcats";

// Tax-claim tagging endpoint (service-role, server-only). Separate from the
// v1 review endpoint: this only touches the tax layer (deductible / tax_category
// / tax_note), never the budget `status` or `category`. See SOLUTION_DESIGN_TAX.md §4.
//   - Tag one:   { id, deductible?, tax_category?, tax_note? }
//   - Bulk tag:  { ids: string[], deductible?, tax_category?, tax_note? }
// Setting a deductible tax_category implies deductible=true unless explicitly
// overridden; picking `not_deductible` implies deductible=false.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    id?: string;
    ids?: string[];
    deductible?: boolean | null;
    tax_category?: string | null;
    tax_note?: string | null;
  };
  const supabase = createServiceClient();

  const update: Record<string, unknown> = {};

  if (body.tax_category !== undefined) {
    if (body.tax_category && !TAX_CATEGORY_BY_CODE[body.tax_category]) {
      return NextResponse.json({ error: `unknown tax_category: ${body.tax_category}` }, { status: 400 });
    }
    update.tax_category = body.tax_category || null;
    // Infer deductible from the chosen bucket unless the caller set it explicitly.
    if (body.deductible === undefined && body.tax_category) {
      update.deductible = TAX_CATEGORY_BY_CODE[body.tax_category]?.deductible ?? null;
    }
  }
  if (body.deductible !== undefined) update.deductible = body.deductible;
  if (body.tax_note !== undefined) update.tax_note = body.tax_note;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const ids = body.ids?.length ? body.ids : body.id ? [body.id] : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "id or ids required" }, { status: 400 });
  }

  const { error } = await supabase.from("transactions").update(update).in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: ids.length });
}
