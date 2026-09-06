import { NextRequest, NextResponse } from "next/server";
import { completeQuarterlyReview } from "@/lib/quarterlyReviewServer";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { reviewId?: string; elapsedSeconds?: number };
  if (!body.reviewId || typeof body.elapsedSeconds !== "number") {
    return NextResponse.json({ error: "reviewId and elapsedSeconds required" }, { status: 400 });
  }
  const result = await completeQuarterlyReview(body.reviewId, body.elapsedSeconds);
  return NextResponse.json(result);
}
