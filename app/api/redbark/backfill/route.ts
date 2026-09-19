import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { backfillTransactionDetails } from "@/lib/redbarkSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-off, CRON_SECRET-protected: fills detail columns on transactions that
// were imported before migration 0018.
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await backfillTransactionDetails());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
