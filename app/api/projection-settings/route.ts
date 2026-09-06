import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    currentAge?: number;
    personalMonthlyContribution?: number;
    retirementMonthlyContribution?: number;
    otherAssetsGrowthPct?: number;
  };
  const supabase = createServiceClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.currentAge !== undefined) update.current_age = body.currentAge;
  if (body.personalMonthlyContribution !== undefined) update.personal_monthly_contribution = body.personalMonthlyContribution;
  if (body.retirementMonthlyContribution !== undefined) update.retirement_monthly_contribution = body.retirementMonthlyContribution;
  if (body.otherAssetsGrowthPct !== undefined) update.other_assets_growth_pct = body.otherAssetsGrowthPct;

  const { error } = await supabase.from("projection_settings").update(update).eq("id", "main");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
