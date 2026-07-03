import { PageHeader } from "@/components/ui";
import ReclassifyQueue from "@/components/ReclassifyQueue";
import { getAvailablePeriods, fetchAllTransactions } from "@/lib/queries";
import { parsePeriod, periodLabel } from "@/lib/fy";

export const dynamic = "force-dynamic";

export default async function ReclassifyPage({
  searchParams,
}: {
  searchParams: { period?: string; value?: string; category?: string; sub_category?: string; type?: string };
}) {
  const { fys } = await getAvailablePeriods();

  // Default to the most recent financial year if no period chosen.
  const effective =
    !searchParams.period && fys.length > 0
      ? { period: "fy", value: String(fys[0]) }
      : { period: searchParams.period, value: searchParams.value };
  const period = parsePeriod(effective);

  const { rows } = await fetchAllTransactions({
    period,
    status: "approved",
    type: searchParams.type,
    category: searchParams.category,
    sub_category: searchParams.sub_category,
  });

  const what = searchParams.sub_category || searchParams.category || searchParams.type || "transactions";

  // Link back to the Overview for the same period.
  const back = new URLSearchParams();
  if (effective.period) back.set("period", effective.period);
  if (effective.value) back.set("value", effective.value);
  const backHref = `/?${back.toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Reclassify · ${what}`}
        subtitle={`${rows.length.toLocaleString()} approved · ${periodLabel(period)} — change any that are in the wrong category`}
      />
      <ReclassifyQueue rows={rows} backHref={backHref} />
    </div>
  );
}
