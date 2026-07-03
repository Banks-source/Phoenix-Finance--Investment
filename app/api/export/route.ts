import { NextRequest, NextResponse } from "next/server";
import { fetchAllTransactions } from "@/lib/queries";
import { parsePeriod, periodLabel } from "@/lib/fy";

// Download the (approved) transactions for a period as CSV for the accountant.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const period = parsePeriod({ period: sp.get("period") ?? undefined, value: sp.get("value") ?? undefined });
  const { rows } = await fetchAllTransactions({ period, status: "approved" });

  const header = ["Date", "Owner", "Detail", "Merchant", "Category", "Sub-category", "Type", "Amount"];
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [r.date, r.owner, r.detail, r.merchant, r.category, r.sub_category, r.type, r.amount.toFixed(2)]
        .map(escape)
        .join(",")
    ),
  ];

  const filename = `phoenix-${periodLabel(period).replace(/\s+/g, "-").toLowerCase()}.csv`;
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
