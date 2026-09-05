import PeriodSelector from "@/components/PeriodSelector";
import CategoryTrendChart from "@/components/CategoryTrendChart";
import { StatCard, PageHeader } from "@/components/ui";
import {
  getAvailablePeriods,
  fetchTypeTotals,
  fetchCategoryTotals,
  fetchSubCategoryTotals,
  fetchCategoryMonthlyTrend,
} from "@/lib/queries";
import { parsePeriod, periodLabel, EXPENSE_TYPES } from "@/lib/fy";
import { money, TYPE_COLORS } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: { period?: string; value?: string; from?: string; to?: string };
}) {
  const { years, fys } = await getAvailablePeriods();

  // Default to the most recent financial year if no period chosen.
  const effective =
    !searchParams.period && fys.length > 0
      ? { period: "fy", value: String(fys[0]) }
      : searchParams;
  const period = parsePeriod(effective);

  const [totals, categories, incomeSubs, transferSubs, trend] = await Promise.all([
    fetchTypeTotals(period),
    fetchCategoryTotals(period),
    fetchSubCategoryTotals("income", period),
    fetchSubCategoryTotals("transfers", period),
    fetchCategoryMonthlyTrend(period),
  ]);

  const income = totals.income ?? 0;
  const expensesBase = EXPENSE_TYPES.reduce((s, t) => s + Math.abs(totals[t] ?? 0), 0);

  // Preserve the current period on links to the Reclassify page.
  const periodParams: Record<string, string> = {};
  if (effective.period) periodParams.period = effective.period;
  if (effective.value) periodParams.value = effective.value;
  if (effective.from) periodParams.from = effective.from;
  if (effective.to) periodParams.to = effective.to;
  const incomeHref = (name: string) =>
    `/reclassify?${new URLSearchParams({ type: "income", sub_category: name, ...periodParams })}`;
  const expenseHref = (name: string) =>
    `/reclassify?${new URLSearchParams({ category: name, ...periodParams })}`;

  // Income broken down by sub-category (salary, rent received, interest, …).
  // Ashby rent is partly owner-funded: ~$1,300 per disbursement is Lloyd's own
  // money (gift to parents that cycles back as rent), not third-party income.
  const RENT_TOPUP_PER = 1300;
  const incomeCats = incomeSubs.map((s) => {
    const item = {
      category: s.name,
      net: s.net,
      count: s.count,
      abs: Math.abs(s.net),
      href: incomeHref(s.name),
      note: undefined as string | undefined,
    };
    if (s.name === "Rent received") {
      const topup = RENT_TOPUP_PER * s.count;
      const genuine = Math.max(0, item.abs - topup);
      item.note = `incl. ~${money(topup)} owner top-up (your funds) · genuine rent ~${money(genuine)}`;
    }
    return item;
  });
  // Ashby investment-loan costs are stored as transfers (isolated from household
  // spending) but are real property expenses — surface them on the Overview so
  // the expense side mirrors the rent income line.
  const propertyExpenses = transferSubs
    .filter((s) => s.name === "Ashby loan interest" || s.name === "Ashby loan fees")
    .map((s) => ({
      category: s.name,
      net: s.net,
      count: s.count,
      abs: Math.abs(s.net),
      href: `/reclassify?${new URLSearchParams({ sub_category: s.name, ...periodParams })}`,
      note:
        s.name === "Ashby loan interest"
          ? "Ashby investment-loan interest (deductible)"
          : undefined,
    }));
  const expenseCats = [
    ...categories
      .filter((c) => EXPENSE_TYPES.includes(c.type as (typeof EXPENSE_TYPES)[number]))
      .map((c) => ({
        category: c.category,
        net: c.net,
        count: c.count,
        abs: Math.abs(c.net),
        href: expenseHref(c.category),
        note: undefined as string | undefined,
      })),
    ...propertyExpenses,
  ].sort((a, b) => b.abs - a.abs);

  const expenses = expensesBase + propertyExpenses.reduce((s, i) => s + i.abs, 0);
  const net = income - expenses;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle={periodLabel(period)}
        actions={<PeriodSelector years={years} fys={fys} fallback={fys.length > 0 ? `fy:${fys[0]}` : undefined} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Income" value={money(income)} accent={TYPE_COLORS.income} />
        <StatCard label="Expenses" value={money(expenses)} accent={TYPE_COLORS.spending} />
        <StatCard
          label={net >= 0 ? "Surplus" : "Deficit"}
          value={money(net, { sign: true })}
          accent={net >= 0 ? TYPE_COLORS.income : TYPE_COLORS.spending}
        />
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Category trend</h2>
          <span className="text-xs text-gray-400">{periodLabel(period)}, by month</span>
        </div>
        <CategoryTrendChart categories={trend.categories} series={trend.series} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Breakdown
          title="Income"
          items={incomeCats}
          total={income}
          barColor={TYPE_COLORS.income}
          emptyLabel="No income in this period"
        />
        <Breakdown
          title="Expenses"
          items={expenseCats}
          total={expenses}
          barColor={TYPE_COLORS.spending}
          emptyLabel="No expenses in this period"
        />
      </div>
    </div>
  );
}

function Breakdown({
  title,
  items,
  total,
  barColor,
  emptyLabel,
}: {
  title: string;
  items: { category: string; net: number; count: number; abs: number; href: string; note?: string }[];
  total: number;
  barColor: string;
  emptyLabel: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.abs));
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="tabular text-sm font-semibold">{money(total)}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {items.map((i) => {
            const share = total > 0 ? Math.round((i.abs / total) * 100) : 0;
            return (
              <Link
                key={i.category}
                href={i.href}
                className="-mx-2 block rounded-md px-2 py-1 transition-colors hover:bg-gray-50"
              >
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{i.category}</span>
                    <span className="text-xs text-gray-400">{i.count}</span>
                  </span>
                  <span className="tabular font-medium">
                    {money(i.abs)}
                    <span className="ml-1.5 text-xs font-normal text-gray-400">{share}%</span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(i.abs / max) * 100}%`, backgroundColor: barColor }}
                  />
                </div>
                {i.note && (
                  <p className="mt-1 text-xs italic text-amber-600">{i.note}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
