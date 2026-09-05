import PeriodSelector from "@/components/PeriodSelector";
import { PageHeader, TypeBadge, EmptyState } from "@/components/ui";
import { getAvailablePeriods, fetchCategoryTotals } from "@/lib/queries";
import { parsePeriod, periodLabel } from "@/lib/fy";
import { money } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
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

  const rows = await fetchCategoryTotals(period);

  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        subtitle={`Net by category · ${periodLabel(period)}`}
        actions={<PeriodSelector years={years} fys={fys} fallback={fys.length > 0 ? `fy:${fys[0]}` : undefined} />}
      />

      {rows.length === 0 ? (
        <EmptyState>No approved transactions for this period.</EmptyState>
      ) : (
        <div className="card divide-y divide-gray-100">
          {rows.map((r) => (
            <Link
              key={r.category}
              href={`/transactions?${new URLSearchParams({
                ...(searchParams.period ? { period: searchParams.period } : {}),
                ...(searchParams.value ? { value: searchParams.value } : {}),
                ...(searchParams.from ? { from: searchParams.from } : {}),
                ...(searchParams.to ? { to: searchParams.to } : {}),
                category: r.category,
              }).toString()}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50"
            >
              <div className="w-44 shrink-0">
                <div className="font-medium">{r.category}</div>
                <div className="mt-0.5">
                  <TypeBadge type={r.type} />
                </div>
              </div>
              <div className="flex-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(Math.abs(r.net) / maxAbs) * 100}%`,
                      backgroundColor: r.net < 0 ? "#e11d48" : "#059669",
                    }}
                  />
                </div>
              </div>
              <div className="w-28 shrink-0 text-right">
                <div className="tabular font-semibold">{money(r.net, { sign: true })}</div>
                <div className="text-xs text-gray-500">{r.count} txns</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
