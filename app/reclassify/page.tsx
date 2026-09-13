import { PageHeader } from "@/components/ui";
import ReclassifyQueue from "@/components/ReclassifyQueue";
import { fetchAllTransactions } from "@/lib/queries";
import { fetchAllSubCategoryNames } from "@/lib/subCategoriesTable";
import { parsePeriod, periodLabel, DEFAULT_CALENDAR_YEAR } from "@/lib/fy";

export const dynamic = "force-dynamic";

export default async function ReclassifyPage({
  searchParams,
}: {
  searchParams: { period?: string; value?: string; from?: string; to?: string; category?: string; sub_category?: string; type?: string };
}) {
  // Default to the current calendar year if no period chosen.
  const effective = !searchParams.period
    ? { period: "year", value: String(DEFAULT_CALENDAR_YEAR) }
    : { period: searchParams.period, value: searchParams.value, from: searchParams.from, to: searchParams.to };
  const period = parsePeriod(effective);

  const [{ rows }, allSubCategories] = await Promise.all([
    fetchAllTransactions({
      period,
      status: "approved",
      type: searchParams.type,
      category: searchParams.category,
      sub_category: searchParams.sub_category,
    }),
    fetchAllSubCategoryNames(),
  ]);

  const what = searchParams.sub_category || searchParams.category || searchParams.type || "transactions";

  // Link back to the Overview for the same period.
  const back = new URLSearchParams();
  if (effective.period) back.set("period", effective.period);
  if (effective.value) back.set("value", effective.value);
  if (effective.from) back.set("from", effective.from);
  if (effective.to) back.set("to", effective.to);
  const backHref = `/?${back.toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Reclassify · ${what}`}
        subtitle={`${rows.length.toLocaleString()} approved · ${periodLabel(period)} — change any that are in the wrong category`}
      />
      <ReclassifyQueue rows={rows} backHref={backHref} allSubCategories={allSubCategories} />
    </div>
  );
}
