import { PageHeader, EmptyState } from "@/components/ui";
import BudgetTable from "@/components/BudgetTable";
import { CATEGORIES } from "@/lib/taxonomy";
import { EXPENSE_TYPES, DEFAULT_CALENDAR_YEAR } from "@/lib/fy";
import { fetchYtdAverageByCategory, fetchCategoryBudgets, fetchMonthSpendByCategory } from "@/lib/budgets";
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

  const [ytdAverages, savedBudgets, monthSpend] = await Promise.all([
    fetchYtdAverageByCategory(DEFAULT_CALENDAR_YEAR),
    fetchCategoryBudgets(),
    fetchMonthSpendByCategory(year, month),
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
