import { createServiceClient } from "@/lib/supabase/server";
import { TYPE_LABELS } from "@/lib/taxonomy";
import DeficitChart from "@/components/DeficitChart";

// Overview tab: household summary, deficit/surplus tracker, this-month snapshot.
export default async function OverviewPage() {
  const supabase = createServiceClient();

  const { data: monthly } = await supabase
    .from("transactions")
    .select("date, amount, type")
    .eq("status", "approved")
    .order("date", { ascending: true });

  const byMonth: Record<string, Record<string, number>> = {};
  for (const row of monthly ?? []) {
    const month = row.date?.slice(0, 7) ?? "unknown";
    byMonth[month] ??= {};
    byMonth[month][row.type] = (byMonth[month][row.type] ?? 0) + Number(row.amount);
  }

  const months = Object.keys(byMonth).sort();
  const deficitSeries = months.map((m) => {
    const income = byMonth[m]["income"] ?? 0;
    const spending = byMonth[m]["spending"] ?? 0;
    const bills = byMonth[m]["bills_fixed"] ?? 0;
    const debt = byMonth[m]["debt"] ?? 0;
    return { month: m, net: income + spending + bills + debt };
  });

  const latest = months.at(-1);
  const latestTotals = latest ? byMonth[latest] : {};

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Household snapshot — combined store (see SOLUTION_DESIGN.md §4 for the partition decision).
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <div key={key} className="rounded-lg border border-neutral-800 p-4">
            <div className="text-xs text-neutral-400">{label}</div>
            <div className="mt-1 text-lg font-medium">
              ${(latestTotals[key] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-300">Deficit / surplus trend</h2>
        <DeficitChart data={deficitSeries} />
      </section>
    </div>
  );
}
