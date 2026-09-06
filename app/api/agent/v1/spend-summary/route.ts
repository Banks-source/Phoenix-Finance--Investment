import { NextRequest, NextResponse } from "next/server";
import { fetchCategoryTotals } from "@/lib/queries";
import { parsePeriod, EXPENSE_TYPES } from "@/lib/fy";

export const dynamic = "force-dynamic";

// Aggregated spend by category — aggregates only, no transaction line items,
// per the issue's explicit "no raw transactions" data-minimisation rule.
// ?period=fy&value=2027, ?period=year&value=2026, ?period=custom&from=&to=,
// or omit for all-time.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const period = parsePeriod({
    period: sp.get("period") ?? undefined,
    value: sp.get("value") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });
  const rows = await fetchCategoryTotals(period);
  const expenseRows = rows.filter((r) => (EXPENSE_TYPES as string[]).includes(r.type));

  return NextResponse.json({
    as_of: new Date().toISOString(),
    period: period.kind,
    categories: expenseRows.map((r) => ({ category: r.category, type: r.type, net_aud: r.net, count: r.count })),
  });
}
