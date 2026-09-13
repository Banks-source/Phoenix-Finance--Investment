import PeriodSelector from "@/components/PeriodSelector";
import { PageHeader, TypeBadge, EmptyState } from "@/components/ui";
import { getAvailablePeriods, fetchCategoryTotals, fetchSubCategoryTotalsForCategory } from "@/lib/queries";
import { parsePeriod, periodLabel, DEFAULT_CALENDAR_YEAR } from "@/lib/fy";
import { money } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: { period?: string; value?: string; from?: string; to?: string; category?: string };
}) {
  const { years, fys } = await getAvailablePeriods();

  // Default to the current calendar year if no period chosen.
  const effective = !searchParams.period ? { period: "year", value: String(DEFAULT_CALENDAR_YEAR) } : searchParams;
  const period = parsePeriod(effective);

  const periodParams = new URLSearchParams();
  if (searchParams.period) periodParams.set("period", searchParams.period);
  if (searchParams.value) periodParams.set("value", searchParams.value);
  if (searchParams.from) periodParams.set("from", searchParams.from);
  if (searchParams.to) periodParams.set("to", searchParams.to);

  const category = searchParams.category;

  if (category) {
    // Level 2: sub-categories within this category.
    const rows = await fetchSubCategoryTotalsForCategory(category, period);
    const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
    const total = rows.reduce((s, r) => s + r.count, 0);

    const withCategory = new URLSearchParams(periodParams);
    withCategory.set("category", category);

    return (
      <div className="space-y-6">
        <PageHeader
          title={category}
          subtitle={`Net by sub-category · ${periodLabel(period)}`}
          actions={<PeriodSelector years={years} fys={fys} fallback={`year:${DEFAULT_CALENDAR_YEAR}`} />}
        />

        <div className="flex items-center justify-between">
          <Link href={`/categories?${periodParams.toString()}`} className="text-sm text-indigo-600 hover:underline">
            ← All categories
          </Link>
          <Link href={`/transactions?${withCategory.toString()}`} className="text-sm text-indigo-600 hover:underline">
            View all {total.toLocaleString()} transactions in {category} →
          </Link>
        </div>

        {rows.length === 0 ? (
          <EmptyState>No approved transactions in {category} for this period.</EmptyState>
        ) : (
          <div className="card divide-y divide-gray-100">
            {rows.map((r) => {
              const link = new URLSearchParams(withCategory);
              link.set("sub_category", r.name);
              return (
                <Link
                  key={r.name}
                  href={`/transactions?${link.toString()}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50"
                >
                  <div className="w-44 shrink-0 truncate font-medium">{r.name}</div>
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
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Level 1: top-level categories.
  const rows = await fetchCategoryTotals(period);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        subtitle={`Net by category · ${periodLabel(period)}`}
        actions={<PeriodSelector years={years} fys={fys} fallback={`year:${DEFAULT_CALENDAR_YEAR}`} />}
      />

      {rows.length === 0 ? (
        <EmptyState>No approved transactions for this period.</EmptyState>
      ) : (
        <div className="card divide-y divide-gray-100">
          {rows.map((r) => {
            const link = new URLSearchParams(periodParams);
            link.set("category", r.category);
            const txnLink = new URLSearchParams(periodParams);
            txnLink.set("category", r.category);
            return (
              <div key={r.category} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                <Link href={`/categories?${link.toString()}`} className="flex flex-1 items-center gap-4">
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
                <Link
                  href={`/transactions?${txnLink.toString()}`}
                  className="shrink-0 whitespace-nowrap text-xs text-indigo-600 hover:underline"
                  title={`View all transactions in ${r.category}`}
                >
                  Transactions →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
