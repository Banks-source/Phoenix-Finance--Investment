import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const VALID_KEYS = new Set(["btc_pct_of_nw_max", "single_asset_pct_max", "lvr_pct_max", "liquidity_months"]);

// Edits an editable hard-rule threshold (#7 promoted to editable — see
// migration 0011). Every hard rule reads these live on each evaluation.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { param_key?: string; value?: number };
  if (!body.param_key || !VALID_KEYS.has(body.param_key)) {
    return NextResponse.json({ error: "unknown param_key" }, { status: 400 });
  }
  if (typeof body.value !== "number" || Number.isNaN(body.value)) {
    return NextResponse.json({ error: "value must be a number" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("hard_rule_params")
    .update({ value: body.value, updated_at: new Date().toISOString() })
    .eq("param_key", body.param_key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
