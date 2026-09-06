import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { THESIS_SLEEVES } from "@/lib/sleeves";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { sleeve?: string; annual_growth_pct?: number };
  if (!body.sleeve || !(THESIS_SLEEVES as string[]).includes(body.sleeve)) {
    return NextResponse.json({ error: "unknown sleeve" }, { status: 400 });
  }
  if (typeof body.annual_growth_pct !== "number" || Number.isNaN(body.annual_growth_pct)) {
    return NextResponse.json({ error: "annual_growth_pct must be a number" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("sleeve_growth_rates")
    .upsert(
      { sleeve: body.sleeve, annual_growth_pct: body.annual_growth_pct, updated_at: new Date().toISOString() },
      { onConflict: "sleeve" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
