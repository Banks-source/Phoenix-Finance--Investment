import { NextResponse } from "next/server";
import { fetchAllocationSummary } from "@/lib/allocation";

export const dynamic = "force-dynamic";

// Holdings flagged as breaching the thesis (#8). No internal ids exposed —
// name + amount + reason is enough for a model to reason about, per the
// "expose questions, not schema" design principle.
export async function GET() {
  const summary = await fetchAllocationSummary();
  return NextResponse.json({
    as_of: new Date().toISOString(),
    positions: summary.legacyPositions.map((p) => ({
      name: p.name,
      group: p.portfolioName,
      amount_aud: p.amountAud,
      reason: p.reason,
      breached_rule: p.breachedRule,
      review_date: p.reviewDate,
      decision: p.decision,
    })),
  });
}
