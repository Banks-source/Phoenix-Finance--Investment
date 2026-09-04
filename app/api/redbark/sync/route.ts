import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { runRedbarkSync } from "@/lib/redbarkSync";

export const dynamic = "force-dynamic";

// Triggered daily by Vercel Cron (see vercel.json). Same CRON_SECRET pattern
// as /api/kubera/sync — not reachable without the bearer token, and carved
// out of the login-wall middleware matcher since Vercel Cron has no session.
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runRedbarkSync();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
