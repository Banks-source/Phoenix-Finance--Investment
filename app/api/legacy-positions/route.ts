import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Flag a holding as breaching the thesis (#8), or update its exit/hold/
// reclassify decision. Every flag requires a reason and a review date —
// no silent flag-and-forget.
//   - Flag one:      { kubera_portfolio_id, asset_id, asset_name, reason, review_date, breached_rule? }
//   - Set decision:  { kubera_portfolio_id, asset_id, decision, decision_note? }
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    kubera_portfolio_id?: string;
    asset_id?: string;
    asset_name?: string;
    reason?: string;
    breached_rule?: number;
    review_date?: string;
    decision?: "exit" | "hold" | "reclassify";
    decision_note?: string;
  };
  if (!body.kubera_portfolio_id || !body.asset_id) {
    return NextResponse.json({ error: "kubera_portfolio_id and asset_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (body.reason || body.review_date || body.asset_name) {
    if (!body.asset_name || !body.reason || !body.review_date) {
      return NextResponse.json({ error: "asset_name, reason, and review_date required to flag a legacy position" }, { status: 400 });
    }
    const { error } = await supabase.from("legacy_positions").upsert(
      {
        kubera_portfolio_id: body.kubera_portfolio_id,
        asset_id: body.asset_id,
        asset_name: body.asset_name,
        reason: body.reason,
        breached_rule: body.breached_rule ?? null,
        review_date: body.review_date,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "kubera_portfolio_id,asset_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.decision) {
    if (!["exit", "hold", "reclassify"].includes(body.decision)) {
      return NextResponse.json({ error: "decision must be exit, hold, or reclassify" }, { status: 400 });
    }
    const { error } = await supabase
      .from("legacy_positions")
      .update({ decision: body.decision, decision_note: body.decision_note ?? null, updated_at: new Date().toISOString() })
      .eq("kubera_portfolio_id", body.kubera_portfolio_id)
      .eq("asset_id", body.asset_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "nothing to update" }, { status: 400 });
}
