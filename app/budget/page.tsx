import { PageHeader, EmptyState } from "@/components/ui";
import BudgetTable from "@/components/BudgetTable";
import { CATEGORIES } from "@/lib/taxonomy";
import { EXPENSE_TYPES, DEFAULT_CALENDAR_YEAR } from "@/lib/fy";
import { fetchYtdAverageByCategory, fetchCategoryBudgets, fetchCurrentMonthSpendByCategory } from "@/lib/budgets";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const [ytdAverages, savedBudgets, monthSpend] = await Promise.all([
    fetchYtdAverageByCategory(DEFAULT_CALENDAR_YEAR),
    fetchCategoryBudgets(),
    fetchCurrentMonthSpendByCategory(),
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        subtitle={`Monthly targets, defaulted to your ${DEFAULT_CALENDAR_YEAR} year-to-date average — click any amount to override. This month: $${totalSpent.toLocaleString(
          undefined,
          { maximumFractionDigits: 0 }
        )} of $${totalBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`}
      />

      {rows.length === 0 ? (
        <EmptyState>No expense categories yet.</EmptyState>
      ) : (
        <BudgetTable rows={rows} />
      )}
    </div>
  );
}
