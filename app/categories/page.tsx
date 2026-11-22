import PeriodSelector from "@/components/PeriodSelector";
import { PageHeader, TypeBadge, EmptyState } from "@/components/ui";
import { getAvailablePeriods, fetchCategoryTotals, fetchSubCategoryTotalsForCategory, fetchUnreviewedSummary } from "@/lib/queries";
import BasisNote from "@/components/BasisNote";
import { parseBasis } from "@/lib/basis";
import { parsePeriod, periodLabel, DEFAULT_CALENDAR_YEAR } from "@/lib/fy";
import { money } from "@/lib/format";
import Link from "next/link";
import SubCategoryList, { SubRow } from "@/components/SubCategoryList";
import { fetchAllSubCategoryNames } from "@/lib/subCategoriesTable";
import { NO_SUB_CATEGORY } from "@/lib/taxonomy";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: { period?: string; value?: string; from?: string; to?: string; category?: string; basis?: string };
}) {
  const { years, fys } = await getAvailablePeriods();

  // Default to the current calendar year if no period chosen.
  const effective = !searchParams.period ? { period: "year", value: String(DEFAULT_CALENDAR_YEAR) } : searchParams;
  const period = parsePeriod(effective);
  const basis = parseBasis(searchParams.basis);
  const unreviewed = await fetchUnreviewedSummary(period);
  // Provisional totals include rows still in review, so the drill-down to transactions must too.
  const statusParam = basis === "all" ? "all" : "approved";

  const periodParams = new URLSearchParams();
  if (searchParams.period) periodParams.set("period", searchParams.period);
  if (searchParams.value) periodParams.set("value", searchParams.value);
  if (searchParams.from) periodParams.set("from", searchParams.from);
  if (searchParams.to) periodParams.set("to", searchParams.to);
  if (basis === "confirmed") periodParams.set("basis", "confirmed");

  const category = searchParams.category;

  if (category) {
    // Level 2: sub-categories within this category.
    const [rows, knownSubs] = await Promise.all([fetchSubCategoryTotalsForCategory(category, period, basis), fetchAllSubCategoryNames()]);
    const total = rows.reduce((s, r) => s + r.count, 0);

    const withCategory = new URLSearchParams(periodParams);
    withCategory.set("category", category);
    const subRows: SubRow[] = rows.map((r) => {
      const key = r.name === "Uncategorised" ? NO_SUB_CATEGORY : r.name;
      const link = new URLSearchParams(withCategory);
      link.set("sub_category", key);
      link.set("status", statusParam);
      return { name: r.name, key, net: r.net, count: r.count, href: `/transactions?${link.toString()}` };
    });
    const scope = {
      period: searchParams.period ?? "year",
      value: searchParams.period ? searchParams.value : String(DEFAULT_CALENDAR_YEAR),
      from: searchParams.from,
      to: searchParams.to,
    };

    return (
      <div className="space-y-6">
        <PageHeader
          title={category}
          subtitle={`Net by sub-category · ${periodLabel(period)}`}
          actions={<PeriodSelector years={years} fys={fys} fallback={`year:${DEFAULT_CALENDAR_YEAR}`} />}
        />

        <BasisNote basis={basis} summary={unreviewed} path="/categories" params={{ ...searchParams }} />

        <div className="flex items-center justify-between">
          <Link href={`/categories?${periodParams.toString()}`} className="text-sm text-indigo-600 hover:underline">
            ← All categories
          </Link>
          <Link href={`/transactions?${withCategory.toString()}&status=${statusParam}`} className="text-sm text-indigo-600 hover:underline">
            View all {total.toLocaleString()} transactions in {category} →
          </Link>
        </div>

        {rows.length === 0 ? (
          <EmptyState>No transactions in {category} for this period.</EmptyState>
        ) : (
          <SubCategoryList category={category} rows={subRows} scope={scope} knownSubs={knownSubs} />
        )}
      </div>
    );
  }

  // Level 1: top-level categories.
  const rows = await fetchCategoryTotals(period, basis);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        subtitle={`Net by category · ${periodLabel(period)}`}
        actions={<PeriodSelector years={years} fys={fys} fallback={`year:${DEFAULT_CALENDAR_YEAR}`} />}
      />

      <BasisNote basis={basis} summary={unreviewed} path="/categories" params={{ ...searchParams }} />

      {rows.length === 0 ? (
        <EmptyState>No transactions for this period.</EmptyState>
      ) : (
        <div className="card divide-y divide-gray-100">
          {rows.map((r) => {
            const link = new URLSearchParams(periodParams);
            link.set("category", r.category);
            const txnLink = new URLSearchParams(periodParams);
            txnLink.set("category", r.category);
            txnLink.set("status", statusParam);
            return (
              <div key={r.category} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <Link href={`/categories?${link.toString()}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{r.category}</span>
                      <TypeBadge type={r.type} />
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(Math.abs(r.net) / maxAbs) * 100}%`, backgroundColor: r.net < 0 ? "#e11d48" : "#059669" }}
                      />
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-right">
                    <div className="text-sm font-semibold tabular">{money(r.net, { sign: true })}</div>
                    <div className="text-xs text-gray-500">{r.count} txns</div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-gray-300" />
                </Link>
                <Link
                  href={`/transactions?${txnLink.toString()}`}
                  className="hidden shrink-0 whitespace-nowrap text-xs text-indigo-600 hover:underline sm:block"
                  title={`View all transactions in ${r.category}`}
                >
                  Transactions
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
