import { NextResponse } from "next/server";
import { runDailyPipeline } from "@/lib/dailyPipeline";

export const maxDuration = 300;

// The "Auto-categorise now" button on Review. Behind the normal login.
export async function POST() {
  try {
    return NextResponse.json({ ok: true, ...(await runDailyPipeline()) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
