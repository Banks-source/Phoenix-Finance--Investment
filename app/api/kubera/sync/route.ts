import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { runKuberaSync } from "@/lib/kuberaSync";

export const dynamic = "force-dynamic";

// Triggered nightly by Vercel Cron (see vercel.json). Not reachable without
// the CRON_SECRET bearer token — this is not part of the user-facing app and
// deliberately bypasses the login-wall middleware matcher, so it enforces its
// own auth here rather than relying on session cookies.
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runKuberaSync();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
