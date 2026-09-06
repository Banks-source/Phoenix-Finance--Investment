import { NextRequest, NextResponse } from "next/server";
import { fetchNetWorthHistory } from "@/lib/allocation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const history = await fetchNetWorthHistory(sp.get("from") ?? undefined, sp.get("to") ?? undefined);
  return NextResponse.json({
    as_of: new Date().toISOString(),
    series: history.map((h) => ({ synced_at: h.syncedAt, net_worth_aud: h.netWorthAud })),
  });
}
