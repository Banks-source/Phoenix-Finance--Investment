import PeriodSelector from "@/components/PeriodSelector";
import TransactionsTable from "@/components/TransactionsTable";
import { PageHeader, EmptyState } from "@/components/ui";
import { getAvailablePeriods, fetchTransactions } from "@/lib/queries";
import { parsePeriod, periodLabel } from "@/lib/fy";
import { taxLabel } from "@/lib/taxcats";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { period?: string; value?: string; search?: string; category?: string; owner?: string; tax_category?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const { years, fys } = await getAvailablePeriods();

  // Default to the most recent financial year if no period chosen.
  const effective =
    !searchParams.period && fys.length > 0
      ? { period: "fy", value: String(fys[0]) }
      : searchParams;
  const period = parsePeriod(effective);

  const { rows, count } = await fetchTransactions({
    period,
    status: "approved",
    search: searchParams.search,
    owner: searchParams.owner,
    tax_category: searchParams.tax_category,
    limit: PAGE_SIZE,
    offset,
  });

  const filtered = searchParams.category
    ? rows.filter((r) => r.category === searchParams.category)
    : rows;

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const baseParams = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (searchParams.period) p.set("period", searchParams.period);
    if (searchParams.value) p.set("value", searchParams.value);
    if (searchParams.search) p.set("search", searchParams.search);
    if (searchParams.owner) p.set("owner", searchParams.owner);
    if (searchParams.category) p.set("category", searchParams.category);
    if (searchParams.tax_category) p.set("tax_category", searchParams.tax_category);
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle={`${count.toLocaleString()} approved · ${periodLabel(period)}${searchParams.category ? ` · ${searchParams.category}` : ""}${searchParams.tax_category ? ` · ${taxLabel(searchParams.tax_category)}` : ""}`}
        actions={<PeriodSelector years={years} fys={fys} fallback={fys.length > 0 ? `fy:${fys[0]}` : undefined} />}
      />

      <form className="flex flex-wrap items-center gap-2" action="/transactions">
        {searchParams.period && <input type="hidden" name="period" value={searchParams.period} />}
        {searchParams.value && <input type="hidden" name="value" value={searchParams.value} />}
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
        {(searchParams.search || searchParams.owner || searchParams.category || searchParams.tax_category) && (
          <Link className="btn-ghost" href={`/transactions?${baseParams({}).replace(/(search|owner|category|tax_category)=[^&]*&?/g, "")}`}>
            Clear
          </Link>
        )}
      </form>

      {filtered.length === 0 ? (
        <EmptyState>No transactions match these filters.</EmptyState>
      ) : (
        <>
          <TransactionsTable rows={filtered} />
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
