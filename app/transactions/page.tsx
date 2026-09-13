import PeriodSelector from "@/components/PeriodSelector";
import TransactionsTable from "@/components/TransactionsTable";
import { PageHeader, EmptyState, StatCard } from "@/components/ui";
import { getAvailablePeriods, fetchTransactions, fetchMoneyMovementBreakdown } from "@/lib/queries";
import { fetchAllSubCategoryNames } from "@/lib/subCategoriesTable";
import { parsePeriod, periodLabel, DEFAULT_CALENDAR_YEAR } from "@/lib/fy";
import { taxLabel } from "@/lib/taxcats";
import { money } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: {
    period?: string;
    value?: string;
    from?: string;
    to?: string;
    search?: string;
    category?: string;
    sub_category?: string;
    owner?: string;
    tax_category?: string;
    page?: string;
  };
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const { years, fys } = await getAvailablePeriods();

  // Default to the current calendar year if no period chosen.
  const effective = !searchParams.period ? { period: "year", value: String(DEFAULT_CALENDAR_YEAR) } : searchParams;
  const period = parsePeriod(effective);

  const [{ rows, count }, allSubCategories] = await Promise.all([
    fetchTransactions({
      period,
      status: "approved",
      search: searchParams.search,
      owner: searchParams.owner,
      category: searchParams.category,
      sub_category: searchParams.sub_category,
      tax_category: searchParams.tax_category,
      limit: PAGE_SIZE,
      offset,
    }),
    fetchAllSubCategoryNames(),
  ]);

  const moneyMovement = searchParams.category === "Money Movement" ? await fetchMoneyMovementBreakdown(period) : null;

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const baseParams = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (searchParams.period) p.set("period", searchParams.period);
    if (searchParams.value) p.set("value", searchParams.value);
    if (searchParams.from) p.set("from", searchParams.from);
    if (searchParams.to) p.set("to", searchParams.to);
    if (searchParams.search) p.set("search", searchParams.search);
    if (searchParams.owner) p.set("owner", searchParams.owner);
    if (searchParams.category) p.set("category", searchParams.category);
    if (searchParams.sub_category) p.set("sub_category", searchParams.sub_category);
    if (searchParams.tax_category) p.set("tax_category", searchParams.tax_category);
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  };

  const categoriesHref = (() => {
    if (!searchParams.category) return null;
    const p = new URLSearchParams();
    if (searchParams.period) p.set("period", searchParams.period);
    if (searchParams.value) p.set("value", searchParams.value);
    if (searchParams.from) p.set("from", searchParams.from);
    if (searchParams.to) p.set("to", searchParams.to);
    p.set("category", searchParams.category);
    return `/categories?${p.toString()}`;
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle={`${count.toLocaleString()} approved · ${periodLabel(period)}${searchParams.category ? ` · ${searchParams.category}` : ""}${searchParams.sub_category ? ` · ${searchParams.sub_category}` : ""}${searchParams.tax_category ? ` · ${taxLabel(searchParams.tax_category)}` : ""}`}
        actions={<PeriodSelector years={years} fys={fys} fallback={`year:${DEFAULT_CALENDAR_YEAR}`} />}
      />

      {categoriesHref && (
        <Link href={categoriesHref} className="text-sm text-indigo-600 hover:underline">
          ← Back to {searchParams.category} sub-categories
        </Link>
      )}

      {moneyMovement && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Internal transfers"
            value={money(moneyMovement.internalTotal)}
            sub={`${moneyMovement.internalCount.toLocaleString()} txns · between our own accounts, net-worth neutral`}
          />
          <StatCard
            label="External transfers"
            value={money(moneyMovement.externalTotal)}
            sub={`${moneyMovement.externalCount.toLocaleString()} txns · actually left the household`}
            accent="#d97706"
          />
          <StatCard
            label="Needs review"
            value={moneyMovement.unclassifiedCount.toLocaleString()}
            sub="not yet identified as internal or external"
          />
        </div>
      )}

      <form className="flex flex-wrap items-center gap-2" action="/transactions">
        {searchParams.period && <input type="hidden" name="period" value={searchParams.period} />}
        {searchParams.value && <input type="hidden" name="value" value={searchParams.value} />}
        {searchParams.from && <input type="hidden" name="from" value={searchParams.from} />}
        {searchParams.to && <input type="hidden" name="to" value={searchParams.to} />}
        {searchParams.category && <input type="hidden" name="category" value={searchParams.category} />}
        {searchParams.sub_category && <input type="hidden" name="sub_category" value={searchParams.sub_category} />}
        <input
          name="search"
          placeholder="Search detail or merchant…"
          defaultValue={searchParams.search ?? ""}
          className="input w-64"
        />
        <select name="owner" defaultValue={searchParams.owner ?? ""} className="select">
          <option value="">All owners</option>
          <option value="lloyd">Lloyd</option>
          <option value="milani">Milani</option>
          <option value="joint">Joint</option>
        </select>
        <button className="btn-primary" type="submit">Filter</button>
        {(searchParams.search || searchParams.owner || searchParams.category || searchParams.sub_category || searchParams.tax_category) && (
          <Link
            className="btn-ghost"
            href={`/transactions?${baseParams({}).replace(/(search|owner|category|sub_category|tax_category)=[^&]*&?/g, "")}`}
          >
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState>No transactions match these filters.</EmptyState>
      ) : (
        <>
          <TransactionsTable rows={rows} allSubCategories={allSubCategories} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link className="btn-ghost" href={`/transactions?${baseParams({ page: String(page - 1) })}`}>Previous</Link>
                )}
                {page < totalPages && (
                  <Link className="btn-ghost" href={`/transactions?${baseParams({ page: String(page + 1) })}`}>Next</Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
