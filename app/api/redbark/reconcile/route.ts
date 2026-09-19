import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { runReconciliation } from "@/lib/reconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// CRON_SECRET-protected. GET = dry run (report only); add ?apply=1 to write:
// link matched rows to their bank record, add rows missing from the database,
// and flag suspect rows — all into Review with a reason.
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apply = new URL(req.url).searchParams.get("apply") === "1";
  try {
    return NextResponse.json(await runReconciliation({ apply }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
