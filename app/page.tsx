import PeriodSelector from "@/components/PeriodSelector";
import NetWorthTrend from "@/components/NetWorthTrend";
import BankLogo from "@/components/BankLogo";
import { PageHeader } from "@/components/ui";
import { getAvailablePeriods, fetchTypeTotals, fetchCategoryTotals, fetchSubCategoryTotals } from "@/lib/queries";
import { fetchNetWorthHistory } from "@/lib/allocation";
import { fetchBalanceSummary } from "@/lib/balances";
import { fetchCategoryBudgets, fetchMonthSpendByCategory, fetchYtdAverageByCategory } from "@/lib/budgets";
import { CATEGORIES } from "@/lib/taxonomy";
import { parsePeriod, periodLabel, EXPENSE_TYPES, DEFAULT_CALENDAR_YEAR } from "@/lib/fy";
import { money, TYPE_COLORS } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: { period?: string; value?: string; from?: string; to?: string };
}) {
  const { years, fys } = await getAvailablePeriods();

  const effective = !searchParams.period ? { period: "year", value: String(DEFAULT_CALENDAR_YEAR) } : searchParams;
  const period = parsePeriod(effective);

  const today = new Date();
  const [totals, categories, incomeSubs, transferSubs, netWorthHistory, balances, budgets, monthSpend, ytdAverages] =
    await Promise.all([
      fetchTypeTotals(period),
      fetchCategoryTotals(period),
      fetchSubCategoryTotals("income", period),
      fetchSubCategoryTotals("transfers", period),
      fetchNetWorthHistory(),
      fetchBalanceSummary(),
      fetchCategoryBudgets(),
      fetchMonthSpendByCategory(today.getFullYear(), today.getMonth() + 1),
      fetchYtdAverageByCategory(DEFAULT_CALENDAR_YEAR),
    ]);

  // ---- Budget position for the month in progress -------------------------
  const expenseCategories = CATEGORIES.filter((c) => EXPENSE_TYPES.includes(c.type as (typeof EXPENSE_TYPES)[number]));
  const budgetRows = expenseCategories
    .map((c) => {
      const target = budgets[c.name] ?? ytdAverages[c.name] ?? 0;
      const spent = monthSpend[c.name] ?? 0;
      return { category: c.name, target, spent, pct: target > 0 ? (spent / target) * 100 : 0 };
    })
    .filter((r) => r.target > 0 || r.spent > 0);

  const budgetTotal = budgetRows.reduce((s, r) => s + r.target, 0);
  const spentTotal = budgetRows.reduce((s, r) => s + r.spent, 0);
  const budgetPct = budgetTotal > 0 ? Math.round((spentTotal / budgetTotal) * 100) : 0;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - today.getDate();
  const monthName = today.toLocaleString(undefined, { month: "long" });
  const attention = [...budgetRows].filter((r) => r.target > 0).sort((a, b) => b.pct - a.pct).slice(0, 4);

  // ---- Period breakdowns (kept below the fold) ---------------------------
  const income = totals.income ?? 0;
  const expensesBase = EXPENSE_TYPES.reduce((s, t) => s + Math.abs(totals[t] ?? 0), 0);

  const periodParams: Record<string, string> = {};
  if (effective.period) periodParams.period = effective.period;
  if (effective.value) periodParams.value = effective.value;
  if (effective.from) periodParams.from = effective.from;
  if (effective.to) periodParams.to = effective.to;
  const incomeHref = (name: string) =>
    `/reclassify?${new URLSearchParams({ type: "income", sub_category: name, ...periodParams })}`;
  const expenseHref = (name: string) => `/reclassify?${new URLSearchParams({ category: name, ...periodParams })}`;

  const incomeCats = incomeSubs.map((s) => ({
    category: s.name,
    count: s.count,
    abs: Math.abs(s.net),
    href: incomeHref(s.name),
    note: undefined as string | undefined,
  }));
  const propertyExpenses = transferSubs
    .filter((s) => s.name === "Ashby loan interest" || s.name === "Ashby loan fees")
    .map((s) => ({
      category: s.name,
      count: s.count,
      abs: Math.abs(s.net),
      href: `/reclassify?${new URLSearchParams({ sub_category: s.name, ...periodParams })}`,
      note: s.name === "Ashby loan interest" ? "Ashby investment-loan interest (deductible)" : undefined,
    }));
  const expenseCats = [
    ...categories
      .filter((c) => EXPENSE_TYPES.includes(c.type as (typeof EXPENSE_TYPES)[number]))
      .map((c) => ({
        category: c.category,
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
    <div className="space-y-5">
      {/* ---- Money on hand ------------------------------------------------ */}
      <section className="card overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b bg-gradient-to-br from-indigo-600 to-indigo-700 px-5 py-5 text-white">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-indigo-200">Available cash</div>
            <div className="mt-1 text-3xl font-semibold tabular">{money(balances.cash)}</div>
            {balances.debt > 0 && (
              <div className="mt-1 text-sm text-indigo-100">
                {money(balances.debt)} owed · {money(balances.net, { sign: true })} net
              </div>
            )}
          </div>
          {/* Placeholders until these balances come from the investment side. */}
          <div className="shrink-0 space-y-2.5 text-right" title="Placeholder — will read from your investment accounts">
            {[
              { name: "Stress Free Life", note: "Personal investment" },
              { name: "Play", note: "High risk" },
            ].map((p) => (
              <div key={p.name}>
                <div className="text-[10px] font-medium uppercase tracking-wide text-indigo-200">{p.name}</div>
                <div className="text-lg font-semibold leading-tight tabular text-indigo-50/90">—</div>
                <div className="text-[10px] text-indigo-200/80">{p.note}</div>
              </div>
            ))}
          </div>
        </div>

        {balances.accounts.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-500">
            No live balances yet — they arrive with the next bank sync.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {balances.accounts.map((a) => (
              <Link key={a.id} href={`/accounts/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                <BankLogo logo={a.logo} institution={a.institution} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.label}</span>
                  <span className="block truncate text-xs text-gray-400">
                    {a.institution}
                    {a.masked ? ` · ${a.masked}` : ""} · {a.owner}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block tabular text-sm font-semibold ${a.current < 0 ? "text-rose-600" : ""}`}>
                    {money(a.current)}
                  </span>
                  {a.available !== null && a.available !== a.current && (
                    <span className="block text-[11px] text-gray-400">{money(a.available)} avail.</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---- This month against budget ------------------------------------ */}
      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">{monthName} budget</h2>
          <Link href="/budget" className="text-xs text-indigo-600 hover:underline">
            View all →
          </Link>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="text-2xl font-semibold tabular">{money(spentTotal)}</div>
            <div className="text-xs text-gray-500">of {money(budgetTotal)} budgeted</div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-semibold tabular ${budgetPct > 100 ? "text-rose-600" : "text-gray-900"}`}>
              {budgetPct}%
            </div>
            <div className="text-xs text-gray-500">{daysLeft} days left</div>
          </div>
        </div>

        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, budgetPct)}%`,
              backgroundColor: budgetPct > 100 ? "#e11d48" : budgetPct > 85 ? "#d97706" : "#4f46e5",
            }}
          />
        </div>

        {attention.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {attention.map((r) => {
              const pct = Math.round(r.pct);
              const over = pct > 100;
              return (
                <Link key={r.category} href="/budget" className="-mx-2 block rounded-md px-2 py-1 hover:bg-gray-50">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-gray-700">{r.category}</span>
                    <span className={`tabular ${over ? "font-semibold text-rose-600" : "text-gray-500"}`}>
                      {money(r.spent)} / {money(r.target)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        backgroundColor: over ? "#e11d48" : pct > 85 ? "#d97706" : "#818cf8",
                      }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- Period detail ------------------------------------------------ */}
      <PageHeader
        title="Overview"
        subtitle={periodLabel(period)}
        actions={<PeriodSelector years={years} fys={fys} fallback={`year:${DEFAULT_CALENDAR_YEAR}`} />}
      />

      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Income" value={money(income)} color={TYPE_COLORS.income} />
        <MiniStat label="Expenses" value={money(expenses)} color={TYPE_COLORS.spending} />
        <MiniStat
          label={net >= 0 ? "Surplus" : "Deficit"}
          value={money(net, { sign: true })}
          color={net >= 0 ? TYPE_COLORS.income : TYPE_COLORS.spending}
        />
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Net worth</h2>
          <Link href="/portfolio" className="text-xs text-indigo-600 hover:underline">
            Portfolio →
          </Link>
        </div>
        <NetWorthTrend points={netWorthHistory} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Breakdown title="Income" items={incomeCats} total={income} barColor={TYPE_COLORS.income} emptyLabel="No income in this period" />
        <Breakdown title="Expenses" items={expenseCats} total={expenses} barColor={TYPE_COLORS.spending} emptyLabel="No expenses in this period" />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5 truncate text-base font-semibold tabular" style={{ color }}>
        {value}
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
  items: { category: string; count: number; abs: number; href: string; note?: string }[];
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
              <Link key={i.category} href={i.href} className="-mx-2 block rounded-md px-2 py-1 transition-colors hover:bg-gray-50">
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
                  <div className="h-full rounded-full" style={{ width: `${(i.abs / max) * 100}%`, backgroundColor: barColor }} />
                </div>
                {i.note && <p className="mt-1 text-xs italic text-amber-600">{i.note}</p>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
