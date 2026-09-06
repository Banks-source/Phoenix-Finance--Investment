import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { THESIS_SLEEVES } from "@/lib/sleeves";

// Set a sleeve's target band (#5). Empty by default — same "no targets set
// until you add them" pattern as `budgets`.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { sleeve?: string; min_pct?: number; max_pct?: number };
  if (!body.sleeve || !(THESIS_SLEEVES as string[]).includes(body.sleeve)) {
    return NextResponse.json({ error: "unknown sleeve" }, { status: 400 });
  }
  if (typeof body.min_pct !== "number" || typeof body.max_pct !== "number" || body.min_pct > body.max_pct) {
    return NextResponse.json({ error: "min_pct/max_pct required, min must be <= max" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("sleeve_targets")
    .upsert(
      { sleeve: body.sleeve, min_pct: body.min_pct, max_pct: body.max_pct, updated_at: new Date().toISOString() },
      { onConflict: "sleeve" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
