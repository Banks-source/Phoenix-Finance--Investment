import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// FY claim-estimate endpoint (service-role, server-only). Stores a manual
// override for a person + financial year + normalised claim category. Sending a
// null/blank amount clears the override so the UI falls back to the computed
// estimate. See migration 0003_claim_estimates.sql.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    person?: string;
    fy?: number;
    category?: string;
    amount?: number | string | null;
  };
  const { person, fy, category } = body;
  if (!person || !fy || !category) {
    return NextResponse.json({ error: "person, fy and category are required" }, { status: 400 });
  }
  if (person !== "lloyd" && person !== "milani") {
    return NextResponse.json({ error: "unknown person" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const raw = body.amount;

  // Clear the override.
  if (raw == null || raw === "") {
    const { error } = await supabase.from("claim_estimates").delete().match({ person, fy, category });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  }

  const { error } = await supabase
    .from("claim_estimates")
    .upsert({ person, fy, category, amount, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, amount });
}
