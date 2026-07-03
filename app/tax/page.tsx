import PeriodSelector from "@/components/PeriodSelector";
import { PageHeader, StatCard, TypeBadge, EmptyState } from "@/components/ui";
import { getAvailablePeriods, fetchTypeTotals, fetchCategoryTotals, fetchAllTransactions } from "@/lib/queries";
import { parsePeriod, periodLabel, fyLabel, EXPENSE_TYPES } from "@/lib/fy";
import { money, TYPE_COLORS } from "@/lib/format";
import { Download } from "lucide-react";

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

  const [totals, categories, incomeRows] = await Promise.all([
    fetchTypeTotals(period),
    fetchCategoryTotals(period),
    fetchAllTransactions({ period, status: "approved", type: "income" }),
  ]);

  const income = totals.income ?? 0;
  const expenses = EXPENSE_TYPES.reduce((s, t) => s + Math.abs(totals[t] ?? 0), 0);
  const net = income - expenses;

  // Group income by detail/merchant for the return.
  const incomeByLine = new Map<string, number>();
  for (const r of incomeRows.rows) {
    const key = r.merchant || r.detail || "Other income";
    incomeByLine.set(key, (incomeByLine.get(key) ?? 0) + Number(r.amount));
  }
  const incomeLines = [...incomeByLine.entries()].sort((a, b) => b[1] - a[1]);

  const exportHref = `/api/export?${new URLSearchParams(effective as Record<string, string>).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax"
        subtitle={`Return summary · ${periodLabel(period)}`}
        actions={
          <div className="flex items-center gap-2">
            <PeriodSelector years={years} fys={fys} fallback={fys.length > 0 ? `fy:${fys[0]}` : undefined} />
            <a href={exportHref} className="btn-primary">
              <Download size={15} /> Export CSV
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Assessable income" value={money(income)} accent={TYPE_COLORS.income} />
        <StatCard label="Total expenses" value={money(expenses)} accent={TYPE_COLORS.spending} />
        <StatCard
          label="Net position"
          value={money(net, { sign: true })}
          accent={net >= 0 ? TYPE_COLORS.income : TYPE_COLORS.spending}
        />
      </div>

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
          <h2 className="mb-3 text-sm font-semibold">Category breakdown</h2>
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
        {period.kind === "fy" ? `${fyLabel(period.value!)} runs 1 Jul ${period.value! - 1} → 30 Jun ${period.value}.` : ""}{" "}
        Figures reflect approved transactions only. Review any pending imports before lodging.
      </p>
    </div>
  );
}
