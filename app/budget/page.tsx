import { PageHeader, EmptyState } from "@/components/ui";
import BudgetTable from "@/components/BudgetTable";
import { CATEGORIES } from "@/lib/taxonomy";
import { EXPENSE_TYPES, DEFAULT_CALENDAR_YEAR } from "@/lib/fy";
import {
  fetchYtdAverageByCategory,
  fetchYtdSpendByCategory,
  fetchCategoryBudgets,
  fetchMonthSpendByCategory,
} from "@/lib/budgets";
import { computeAnnualPace, yearFraction, type PaceStatus } from "@/lib/annualBudget";
import { money } from "@/lib/format";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  const today = new Date();
  const year = Number(searchParams.year) || today.getFullYear();
  const month = Number(searchParams.month) || today.getMonth() + 1; // 1-12

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  const [ytdAverages, savedBudgets, monthSpend, yearSpend] = await Promise.all([
    fetchYtdAverageByCategory(DEFAULT_CALENDAR_YEAR),
    fetchCategoryBudgets(),
    fetchMonthSpendByCategory(year, month),
    fetchYtdSpendByCategory(year),
  ]);

  const expenseCategories = CATEGORIES.filter((c) => EXPENSE_TYPES.includes(c.type as (typeof EXPENSE_TYPES)[number]));

  const rows = expenseCategories
    .map((c) => {
      const saved = savedBudgets[c.name];
      const average = ytdAverages[c.name] ?? 0;
      return {
        category: c.name,
        type: c.type,
        budget: saved ?? average,
        isDefault: saved === undefined,
        spent: monthSpend[c.name] ?? 0,
      };
    })
    .sort((a, b) => b.spent - a.spent);

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  // ---- Whole-year view: budget × 12 vs year-to-date, judged against pace ----
  const fraction = yearFraction(year, today);
  const ytdTotal = expenseCategories.reduce((s, c) => s + (yearSpend[c.name] ?? 0), 0);
  const pace = computeAnnualPace(totalBudget, ytdTotal, fraction);
  const hot = rows
    .map((r) => {
      const expected = r.budget * 12 * fraction;
      const spentYtd = yearSpend[r.category] ?? 0;
      return { category: r.category, spentYtd, expected, overBy: spentYtd - expected };
    })
    .filter((r) => r.expected > 0 && r.overBy > r.expected * 0.05)
    .sort((a, b) => b.overBy - a.overBy)
    .slice(0, 3);
  const STATUS: Record<PaceStatus, { label: string; cls: string; bar: string }> = {
    on_target: { label: "On target", cls: "bg-emerald-50 text-emerald-700", bar: "#059669" },
    under: { label: "Under pace", cls: "bg-indigo-50 text-indigo-700", bar: "#4f46e5" },
    over: { label: "Over pace", cls: "bg-rose-50 text-rose-700", bar: "#e11d48" },
  };
  const st = STATUS[pace.status];

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const hrefFor = (y: number, m: number) => `/budget?year=${y}&month=${m}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        subtitle={`Monthly targets default to your ${DEFAULT_CALENDAR_YEAR} year-to-date average — click any amount to override.`}
        actions={
          <div className="flex items-center gap-1">
            <Link href={hrefFor(prev.year, prev.month)} className="btn-ghost !px-2 !py-1.5" title="Previous month">
              <ChevronLeft size={16} />
            </Link>
            <span className="w-36 text-center text-sm font-medium">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <Link href={hrefFor(next.year, next.month)} className="btn-ghost !px-2 !py-1.5" title="Next month">
              <ChevronRight size={16} />
            </Link>
            {!isCurrentMonth && (
              <Link href="/budget" className="btn-ghost ml-1 text-xs">
                Today
              </Link>
            )}
          </div>
        }
      />

      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{year} for the year</h2>
            <div className="mt-2 text-2xl font-semibold tabular">{money(pace.ytdSpent)}</div>
            <div className="text-xs text-gray-500">
              of {money(pace.annualBudget)} annual budget · expected {money(pace.expectedToDate)} by now
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
        </div>

        {/* Bar = spend; tick = where a steady spend would be today. */}
        <div className="relative mt-4 h-2.5 w-full rounded-full bg-gray-100">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, pace.annualBudget > 0 ? (pace.ytdSpent / pace.annualBudget) * 100 : 0)}%`,
              backgroundColor: st.bar,
            }}
          />
          {pace.annualBudget > 0 && (
            <div
              className="absolute -top-1 w-0.5 rounded bg-gray-800"
              style={{ left: `${Math.min(100, (pace.expectedToDate / pace.annualBudget) * 100)}%`, height: "18px" }}
              title="Where a steady spend would be by today"
            />
          )}
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>
            {pace.deviationPct >= 0 ? "+" : ""}
            {pace.deviationPct.toFixed(1)}% vs pace
          </span>
          {pace.projected > 0 && <span>On course for {money(pace.projected)}</span>}
        </div>

        {hot.length > 0 && (
          <div className="mt-4 border-t pt-3 text-xs text-gray-600">
            <span className="font-medium text-gray-700">Running ahead of pace: </span>
            {hot.map((h, i) => (
              <span key={h.category}>
                {i > 0 && " · "}
                {h.category} <span className="tabular text-rose-600">+{money(h.overBy)}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="flex gap-4 text-sm text-gray-500">
        <span>
          {isCurrentMonth ? "So far this month" : `${MONTH_NAMES[month - 1]} total`}:{" "}
          <span className="font-semibold text-gray-900">
            ${totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>{" "}
          of ${totalBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })} budgeted
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState>No expense categories yet.</EmptyState>
      ) : (
        <BudgetTable rows={rows} periodLabel={isCurrentMonth ? "this month" : `${MONTH_NAMES[month - 1].slice(0, 3)}`} />
      )}
    </div>
  );
}
