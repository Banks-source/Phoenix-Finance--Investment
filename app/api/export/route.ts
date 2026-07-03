import { NextRequest, NextResponse } from "next/server";
import { fetchAllTransactions } from "@/lib/queries";
import { parsePeriod, periodLabel } from "@/lib/fy";
import { taxLabel } from "@/lib/taxcats";

// Download transactions for a period as CSV for the accountant.
//   default        → every approved transaction
//   ?mode=claims   → only rows tagged deductible, with their ATO category
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const period = parsePeriod({ period: sp.get("period") ?? undefined, value: sp.get("value") ?? undefined });
  const mode = sp.get("mode");
  const { rows } = await fetchAllTransactions({ period, status: "approved" });

  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const claims = mode === "claims";
  const filtered = claims ? rows.filter((r) => r.deductible === true) : rows;

  const header = claims
    ? ["Date", "Owner", "Detail", "Merchant", "Category", "ATO category", "Amount", "Note"]
    : ["Date", "Owner", "Detail", "Merchant", "Category", "Sub-category", "Type", "Amount"];

  const lines = [
    header.join(","),
    ...filtered.map((r) =>
      (claims
        ? [r.date, r.owner, r.detail, r.merchant, r.category, taxLabel(r.tax_category), Math.abs(r.amount).toFixed(2), r.tax_note]
        : [r.date, r.owner, r.detail, r.merchant, r.category, r.sub_category, r.type, r.amount.toFixed(2)]
      )
        .map(escape)
        .join(",")
    ),
  ];

  const suffix = claims ? "-claims" : "";
  const filename = `phoenix-${periodLabel(period).replace(/\s+/g, "-").toLowerCase()}${suffix}.csv`;
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
