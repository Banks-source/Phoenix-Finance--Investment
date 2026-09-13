import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { runBudgetAlertCheck } from "@/lib/runBudgetAlertCheck";

export const dynamic = "force-dynamic";

// Triggered daily by Vercel Cron (see vercel.json) — same CRON_SECRET pattern
// as /api/kubera/sync and /api/redbark/sync.
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runBudgetAlertCheck();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
