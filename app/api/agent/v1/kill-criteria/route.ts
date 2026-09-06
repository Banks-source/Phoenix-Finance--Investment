import { NextResponse } from "next/server";
import { fetchKillCriteriaStatus } from "@/lib/quarterlyReviewServer";

export const dynamic = "force-dynamic";

// Status of all 8 thesis kill criteria — from the most recently completed
// quarterly review, or "not_assessed" for all if none has run yet.
export async function GET() {
  const criteria = await fetchKillCriteriaStatus();
  return NextResponse.json({
    as_of: new Date().toISOString(),
    criteria: criteria.map((k) => ({ text: k.text, status: k.status, note: k.note })),
  });
}
