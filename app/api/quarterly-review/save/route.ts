import { NextRequest, NextResponse } from "next/server";
import { saveQuarterlyReviewProgress } from "@/lib/quarterlyReviewServer";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    reviewId?: string;
    cycleInputsNotes?: string;
    killCriteria?: { text: string; status: "yes" | "no" | "not_assessed"; note: string }[];
    actionsNotes?: string;
  };
  if (!body.reviewId) return NextResponse.json({ error: "reviewId required" }, { status: 400 });
  await saveQuarterlyReviewProgress(body.reviewId, {
    cycleInputsNotes: body.cycleInputsNotes,
    killCriteria: body.killCriteria,
    actionsNotes: body.actionsNotes,
  });
  return NextResponse.json({ ok: true });
}
