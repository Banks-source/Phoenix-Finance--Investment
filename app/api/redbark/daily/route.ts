import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { runDailyPipeline } from "@/lib/dailyPipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Daily 07:30, after the 07:00 bank sync (see vercel.json). Lives under
// /api/redbark so the middleware's cron carve-out applies; same bearer check.
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runDailyPipeline());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
