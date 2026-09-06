import { NextResponse } from "next/server";
import { fetchAllocationSummary } from "@/lib/allocation";

export const dynamic = "force-dynamic";

// #12 — read-only Agent API. Structurally read-only: no POST/PUT/PATCH/DELETE
// handler exists in this file at all. Aggregates only, no account/wallet
// identifiers — data minimisation per the issue's acceptance criteria.
export async function GET() {
  const summary = await fetchAllocationSummary();
  return NextResponse.json({
    as_of: new Date().toISOString(),
    sleeves: summary.sleeves.map((s) => ({
      sleeve: s.sleeve,
      total_aud: s.totalAud,
      pct_of_investable: s.pctOfInvestable,
      min_pct: s.minPct,
      max_pct: s.maxPct,
      breach: s.breach,
    })),
    property_aud: summary.propertyAud,
    legacy_aud: summary.legacyAud,
    investable_total_aud: summary.investableTotalAud,
    unmapped_holding_count: summary.unmappedHoldings.length,
  });
}
