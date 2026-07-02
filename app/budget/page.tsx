import { createServerComponentClient } from "@/lib/supabase/server";
import { TYPE_LABELS } from "@/lib/taxonomy";

// Budget tab: budget-vs-actual by category/type per month, cash-flow forecast.
export default async function BudgetPage() {
  const supabase = createServerComponentClient();
  const thisMonth = new Date().toISOString().slice(0, 7);

  const { data: actuals } = await supabase
    .from("transactions")
    .select("category, type, amount")
    .eq("status", "approved")
    .gte("date", `${thisMonth}-01`);

  const { data: budgets } = await supabase
    .from("budgets")
    .select("category_or_type, target_amount")
    .eq("month", `${thisMonth}-01`);

  const actualByCategory: Record<string, number> = {};
  for (const row of actuals ?? []) {
    actualByCategory[row.category] = (actualByCategory[row.category] ?? 0) + Math.abs(Number(row.amount));
  }
  const budgetByCategory = Object.fromEntries((budgets ?? []).map((b) => [b.category_or_type, b.target_amount]));

  const categories = Array.from(new Set([...Object.keys(actualByCategory), ...Object.keys(budgetByCategory)]));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Budget — {thisMonth}</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-400">
          <tr>
            <th className="py-2">Category</th>
            <th className="py-2 text-right">Budget</th>
            <th className="py-2 text-right">Actual</th>
            <th className="py-2 text-right">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => {
            const budget = budgetByCategory[c] ?? 0;
            const actual = actualByCategory[c] ?? 0;
            const remaining = budget - actual;
            return (
              <tr key={c} className="border-t border-neutral-800">
                <td className="py-2">{c}</td>
                <td className="py-2 text-right">${budget.toLocaleString()}</td>
                <td className="py-2 text-right">${actual.toLocaleString()}</td>
                <td className={`py-2 text-right ${remaining < 0 ? "text-red-400" : "text-green-400"}`}>
                  ${remaining.toLocaleString()}
                </td>
              </tr>
            );
          })}
          {categories.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-neutral-500">
                No budget targets set yet for {thisMonth}. Add rows to the `budgets` table to populate this view.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
