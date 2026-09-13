import { createServiceClient } from "@/lib/supabase/server";
import { EXPENSE_TYPES } from "@/lib/fy";

type AnyClient = ReturnType<typeof createServiceClient>;

async function fetchAll<T>(build: (c: AnyClient) => any): Promise<T[]> {
  const supabase = createServiceClient();
  const out: T[] = [];
  const size = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await build(supabase).range(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
    from += size;
  }
  return out;
}

/**
 * Year-to-date average monthly spend per expense category, for the given
 * year — the default a budget starts at before the user overrides it.
 * "Months elapsed" includes the current partial month as a full unit, same
 * approach as fetchAverageMonthlySpend in lib/queries.ts.
 */
export async function fetchYtdAverageByCategory(year: number): Promise<Record<string, number>> {
  const today = new Date();
  const isCurrentYear = today.getFullYear() === year;
  const monthsElapsed = isCurrentYear ? today.getMonth() + 1 : 12;
  const from = `${year}-01-01`;
  const to = isCurrentYear ? today.toISOString().slice(0, 10) : `${year}-12-31`;

  const rows = await fetchAll<{ category: string | null; type: string; amount: number }>((c) =>
    c.from("transactions").select("category, type, amount").eq("status", "approved").gte("date", from).lte("date", to)
  );

  const totals: Record<string, number> = {};
  for (const r of rows) {
    if (!r.category || !(EXPENSE_TYPES as string[]).includes(r.type)) continue;
    totals[r.category] = (totals[r.category] ?? 0) + Math.abs(Number(r.amount));
  }

  const averages: Record<string, number> = {};
  for (const [cat, total] of Object.entries(totals)) averages[cat] = total / monthsElapsed;
  return averages;
}

/**
 * Actual spend per expense category for one calendar month (1-12). Pass the
 * month being viewed on /budget — defaults to today's month/year there, but
 * the user can page back/forward to any month to check it against budget.
 */
export async function fetchMonthSpendByCategory(year: number, month: number): Promise<Record<string, number>> {
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  // Last real day of the month, or today if it's the month in progress.
  const to = isCurrentMonth ? today.toISOString().slice(0, 10) : new Date(year, month, 0).toISOString().slice(0, 10);

  const rows = await fetchAll<{ category: string | null; type: string; amount: number }>((c) =>
    c.from("transactions").select("category, type, amount").eq("status", "approved").gte("date", from).lte("date", to)
  );

  const totals: Record<string, number> = {};
  for (const r of rows) {
    if (!r.category || !(EXPENSE_TYPES as string[]).includes(r.type)) continue;
    totals[r.category] = (totals[r.category] ?? 0) + Math.abs(Number(r.amount));
  }
  return totals;
}

export async function fetchCategoryBudgets(): Promise<Record<string, number>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("category_budgets").select("category, monthly_target");
  if (error) throw new Error(`category_budgets fetch failed: ${error.message}`);
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.category] = Number(r.monthly_target);
  return out;
}

export async function setCategoryBudget(category: string, monthlyTarget: number): Promise<{ error?: string }> {
  if (!Number.isFinite(monthlyTarget) || monthlyTarget < 0) return { error: "Invalid amount" };
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("category_budgets")
    .upsert({ category, monthly_target: monthlyTarget, updated_at: new Date().toISOString() }, { onConflict: "category" });
  if (error) return { error: error.message };
  return {};
}
