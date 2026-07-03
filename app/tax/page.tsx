import Link from "next/link";
import PeriodSelector from "@/components/PeriodSelector";
import YoyMatrix from "@/components/YoyMatrix";
import { PageHeader, StatCard, TypeBadge, EmptyState } from "@/components/ui";
import {
  getAvailablePeriods,
  fetchTypeTotals,
  fetchCategoryTotals,
  fetchAllTransactions,
  fetchClaimTotals,
  fetchCategoryYoY,
} from "@/lib/queries";
import { parsePeriod, periodLabel, fyLabel, EXPENSE_TYPES } from "@/lib/fy";
import { money, TYPE_COLORS } from "@/lib/format";
import { taxLabel } from "@/lib/taxcats";
import { Download, ListChecks } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TaxPage({
  searchParams,
}: {
  searchParams: { period?: string; value?: string };
}) {
  const { years, fys } = await getAvailablePeriods();

  // Default to the most recent financial year if no period chosen.
  const effective =
    !searchParams.period && fys.length > 0
      ? { period: "fy", value: String(fys[0]) }
      : searchParams;
  const period = parsePeriod(effective);

  // Up to 5 most recent FYs for the year-over-year matrix.
  const yoyFys = fys.slice(0, 5);

  const [totals, categories, incomeRows, claimTotals, yoy] = await Promise.all([
    fetchTypeTotals(period),
    fetchCategoryTotals(period),
    fetchAllTransactions({ period, status: "approved", type: "income" }),
    fetchClaimTotals(period),
    fetchCategoryYoY(yoyFys),
  ]);

  const income = totals.income ?? 0;
  const expenses = EXPENSE_TYPES.reduce((s, t) => s + Math.abs(totals[t] ?? 0), 0);
  const net = income - expenses;

  // Deductions tagged as deductible, split per owner and rolled up by ATO bucket.
  const claimsByOwner = new Map<string, number>();
  const claimsByBucket = new Map<string, { lloyd: number; milani: number; total: number }>();
  let claimTotal = 0;
  for (const c of claimTotals) {
    claimTotal += c.amount;
    claimsByOwner.set(c.owner, (claimsByOwner.get(c.owner) ?? 0) + c.amount);
    const b = claimsByBucket.get(c.tax_category) ?? { lloyd: 0, milani: 0, total: 0 };
    if (c.owner === "lloyd") b.lloyd += c.amount;
    else if (c.owner === "milani") b.milani += c.amount;
    b.total += c.amount;
    claimsByBucket.set(c.tax_category, b);
  }
  const bucketRows = [...claimsByBucket.entries()].sort((a, b) => b[1].total - a[1].total);

  // Group income by detail/merchant for the return.
  const incomeByLine = new Map<string, number>();
  for (const r of incomeRows.rows) {
    const key = r.merchant || r.detail || "Other income";
    incomeByLine.set(key, (incomeByLine.get(key) ?? 0) + Number(r.amount));
  }
  const incomeLines = [...incomeByLine.entries()].sort((a, b) => b[1] - a[1]);

  const exportQs = new URLSearchParams(effective as Record<string, string>);
  const exportHref = `/api/export?${exportQs.toString()}`;
  const claimsExportQs = new URLSearchParams(exportQs);
  claimsExportQs.set("mode", "claims");
  const claimsExportHref = `/api/export?${claimsExportQs.toString()}`;
  const claimsHref = `/tax/claims?${exportQs.toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax"
        subtitle={`FY pack · ${periodLabel(period)}`}
        actions={
          <div className="flex items-center gap-2">
            <PeriodSelector years={years} fys={fys} fallback={fys.length > 0 ? `fy:${fys[0]}` : undefined} />
            <Link href={claimsHref} className="btn-primary">
              <ListChecks size={15} /> Build claims
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assessable income" value={money(income)} accent={TYPE_COLORS.income} />
        <StatCard label="Total expenses" value={money(expenses)} accent={TYPE_COLORS.spending} />
        <StatCard
          label="Net position"
          value={money(net, { sign: true })}
          accent={net >= 0 ? TYPE_COLORS.income : TYPE_COLORS.spending}
        />
        <StatCard
          label="Deductions tagged"
          value={money(claimTotal)}
          accent={TYPE_COLORS.debt}
          sub={
            claimTotal > 0
              ? `Lloyd ${money(claimsByOwner.get("lloyd") ?? 0)} · Milani ${money(claimsByOwner.get("milani") ?? 0)}`
              : "None tagged yet"
          }
        />
      </div>

      {/* Deductions roll-up */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Deductions by ATO category</h2>
          <div className="ml-auto flex items-center gap-2">
            <Link href={claimsHref} className="btn-ghost !py-1 text-xs">
              <ListChecks size={14} /> Edit claims
            </Link>
            <a href={claimsExportHref} className="btn-ghost !py-1 text-xs">
              <Download size={14} /> Claims CSV
            </a>
          </div>
        </div>
        {bucketRows.length === 0 ? (
          <EmptyState>
            No deductions tagged for {periodLabel(period)}.{" "}
            <Link href={claimsHref} className="text-indigo-600 hover:underline">
              Start tagging
            </Link>
            .
          </EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="px-4 py-2 text-left font-medium">Category</th>
                <th className="px-4 py-2 text-right font-medium">Lloyd</th>
                <th className="px-4 py-2 text-right font-medium">Milani</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bucketRows.map(([code, b]) => (
                <tr key={code} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2 font-medium">{taxLabel(code)}</td>
                  <td className="px-4 py-2 text-right tabular">{b.lloyd ? money(b.lloyd) : "—"}</td>
                  <td className="px-4 py-2 text-right tabular">{b.milani ? money(b.milani) : "—"}</td>
                  <td className="px-4 py-2 text-right tabular font-semibold">{money(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Year-over-year matrix */}
      {yoy.length > 0 && <YoyMatrix rows={yoy} fys={yoyFys} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">Income detail</h2>
          {incomeLines.length === 0 ? (
            <EmptyState>No income recorded for this period.</EmptyState>
          ) : (
            <div className="divide-y divide-gray-100">
              {incomeLines.map(([label, amt]) => (
                <div key={label} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate pr-3">{label}</span>
                  <span className="tabular font-medium text-emerald-600">{money(amt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Category breakdown</h2>
            <a href={exportHref} className="btn-ghost !py-1 text-xs">
              <Download size={14} /> All CSV
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {categories.map((c) => (
              <div key={c.category} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2">
                  <TypeBadge type={c.type} />
                  {c.category}
                </span>
                <span className="tabular font-medium">{money(c.net, { sign: true })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        {period.kind === "fy" ? `${fyLabel(period.value!)} runs 1 Jul ${period.value! - 1} → 30 Jun ${period.value}. ` : ""}
        Figures reflect approved transactions only. Nothing is claimed automatically — deductions are the ones you tag in
        the claims builder. Not tax advice.
      </p>
    </div>
  );
}
