import { NextResponse } from "next/server";
import { startQuarterlyReview } from "@/lib/quarterlyReviewServer";

export const dynamic = "force-dynamic";

// Steps 1-2 are pre-computed here — Lloyd reviews rather than enters.
export async function POST() {
  const result = await startQuarterlyReview();
  return NextResponse.json(result);
}
