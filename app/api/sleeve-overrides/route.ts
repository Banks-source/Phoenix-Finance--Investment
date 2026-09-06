import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { SLEEVE_LABELS, SleeveCode } from "@/lib/sleeves";

const VALID_SLEEVES = new Set(Object.keys(SLEEVE_LABELS));

// Manually assign a sleeve to a holding the automatic rules couldn't
// classify (#4/#8) — never guessed, always an explicit human decision.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    kubera_portfolio_id?: string;
    asset_id?: string;
    asset_name?: string;
    sleeve?: SleeveCode;
    note?: string;
  };
  if (!body.kubera_portfolio_id || !body.asset_id || !body.asset_name) {
    return NextResponse.json({ error: "kubera_portfolio_id, asset_id, asset_name required" }, { status: 400 });
  }
  if (!body.sleeve || !VALID_SLEEVES.has(body.sleeve)) {
    return NextResponse.json({ error: "unknown sleeve" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { error } = await supabase.from("sleeve_overrides").upsert(
    {
      kubera_portfolio_id: body.kubera_portfolio_id,
      asset_id: body.asset_id,
      asset_name: body.asset_name,
      sleeve: body.sleeve,
      note: body.note ?? null,
    },
    { onConflict: "kubera_portfolio_id,asset_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
