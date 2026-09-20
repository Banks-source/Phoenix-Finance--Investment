import PeriodSelector from "@/components/PeriodSelector";
import TxnList from "@/components/TxnList";
import { PageHeader, EmptyState, StatCard } from "@/components/ui";
import { getAvailablePeriods, fetchTransactions, fetchMoneyMovementBreakdown, TxnFilter } from "@/lib/queries";
import { fetchAllSubCategoryNames } from "@/lib/subCategoriesTable";
import { parsePeriod, periodLabel, DEFAULT_CALENDAR_YEAR } from "@/lib/fy";
import { taxLabel } from "@/lib/taxcats";
import { CATEGORIES, NO_SUB_CATEGORY } from "@/lib/taxonomy";
import { accountName, AccountRef } from "@/lib/transferAccounts";
import { createServiceClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import Link from "next/link";
import { X } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

type SP = {
  period?: string;
  value?: string;
  from?: string;
  to?: string;
  search?: string;
  category?: string;
  sub_category?: string;
  owner?: string;
  type?: string;
  status?: string; // approved (default) | pending_review | all
  tax_category?: string;
  page?: string;
};

const FILTER_KEYS = ["search", "owner", "category", "sub_category", "type", "tax_category"] as const;

export default async function TransactionsPage({ searchParams }: { searchParams: SP }) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;
  const status = searchParams.status === "pending_review" || searchParams.status === "all" ? searchParams.status : "approved";

  const { years, fys } = await getAvailablePeriods();

  // Default to the current calendar year if no period chosen.
  const effective = !searchParams.period ? { period: "year", value: String(DEFAULT_CALENDAR_YEAR) } : searchParams;
  const period = parsePeriod(effective);

  const [{ rows, count }, allSubCategories, { data: accountRows }] = await Promise.all([
    fetchTransactions({
      period,
      status: status === "all" ? undefined : status,
      search: searchParams.search,
      owner: searchParams.owner,
      category: searchParams.category,
      sub_category: searchParams.sub_category,
      type: searchParams.type,
      tax_category: searchParams.tax_category,
      limit: PAGE_SIZE,
      offset,
    }),
    fetchAllSubCategoryNames(),
    createServiceClient().from("accounts").select("id, institution, account_label, account_number_masked"),
  ]);
  const accountNames: Record<string, string> = {};
  for (const a of (accountRows ?? []) as AccountRef[]) accountNames[a.id] = accountName(a) ?? "";

  const moneyMovement = searchParams.category === "Money Movement" ? await fetchMoneyMovementBreakdown(period) : null;

  // The filters in force, in the shape the edit API accepts for "select all N".
  const filter: TxnFilter = {
    period: effective.period,
    value: effective.value,
    from: effective.from,
    to: effective.to,
    status: status === "all" ? undefined : status,
    search: searchParams.search,
    owner: searchParams.owner,
    category: searchParams.category,
    sub_category: searchParams.sub_category,
    type: searchParams.type,
    tax_category: searchParams.tax_category,
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const qs = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const all: Record<string, string | undefined> = {
      period: searchParams.period,
      value: searchParams.value,
      from: searchParams.from,
      to: searchParams.to,
      status: searchParams.status,
      ...Object.fromEntries(FILTER_KEYS.map((k) => [k, searchParams[k]])),
      ...overrides,
    };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    return p.toString();
  };

  const chips: { label: string; clear: string }[] = [];
  if (searchParams.search) chips.push({ label: `“${searchParams.search}”`, clear: qs({ search: undefined }) });
  if (searchParams.category) chips.push({ label: searchParams.category, clear: qs({ category: undefined, sub_category: undefined }) });
  if (searchParams.sub_category) chips.push({ label: searchParams.sub_category === NO_SUB_CATEGORY ? "› no sub-category" : `› ${searchParams.sub_category}`, clear: qs({ sub_category: undefined }) });
  if (searchParams.type) chips.push({ label: `type: ${searchParams.type}`, clear: qs({ type: undefined }) });
  if (searchParams.owner) chips.push({ label: searchParams.owner, clear: qs({ owner: undefined }) });
  if (searchParams.tax_category) chips.push({ label: taxLabel(searchParams.tax_category), clear: qs({ tax_category: undefined }) });

  const statusLabel = status === "approved" ? "approved" : status === "pending_review" ? "to review" : "all statuses";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transactions"
        subtitle={`${count.toLocaleString()} ${statusLabel} · ${periodLabel(period)}`}
        actions={<PeriodSelector years={years} fys={fys} fallback={`year:${DEFAULT_CALENDAR_YEAR}`} />}
      />

      {searchParams.category && (
        <Link
          href={`/categories?${new URLSearchParams(
            Object.entries({ period: searchParams.period, value: searchParams.value, from: searchParams.from, to: searchParams.to, category: searchParams.category }).filter(
              (e): e is [string, string] => !!e[1]
            )
          )}`}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Back to {searchParams.category}
        </Link>
      )}

      {moneyMovement && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Internal transfers"
            value={money(moneyMovement.internalTotal)}
            sub={`${moneyMovement.internalCount.toLocaleString()} txns · between our own accounts`}
          />
          <StatCard
            label="External transfers"
            value={money(moneyMovement.externalTotal)}
            sub={`${moneyMovement.externalCount.toLocaleString()} txns · left the household`}
            accent="#d97706"
          />
          <StatCard
            label="Needs review"
            value={moneyMovement.unclassifiedCount.toLocaleString()}
            sub="not yet identified as internal or external"
          />
        </div>
      )}

      {/* filters */}
      <form className="card flex flex-wrap items-end gap-2 p-3" action="/transactions">
        {(["period", "value", "from", "to", "type", "sub_category", "tax_category"] as const).map(
          (k) => searchParams[k] && <input key={k} type="hidden" name={k} value={searchParams[k]} />
        )}
        <label className="min-w-[10rem] flex-1 text-xs text-gray-500">
          Search
          <input name="search" placeholder="Merchant or detail" defaultValue={searchParams.search ?? ""} className="input mt-0.5 w-full" />
        </label>
        <label className="text-xs text-gray-500">
          Category
          <select name="category" defaultValue={searchParams.category ?? ""} className="select mt-0.5 block">
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Owner
          <select name="owner" defaultValue={searchParams.owner ?? ""} className="select mt-0.5 block">
            <option value="">All</option>
            <option value="lloyd">Lloyd</option>
            <option value="milani">Milani</option>
            <option value="joint">Joint</option>
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Status
          <select name="status" defaultValue={status} className="select mt-0.5 block">
            <option value="approved">Approved</option>
            <option value="pending_review">To review</option>
            <option value="all">All</option>
          </select>
        </label>
        <button className="btn-primary" type="submit">
          Apply
        </button>
      </form>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <Link
              key={c.label}
              href={`/transactions?${c.clear}`}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
            >
              {c.label} <X size={12} />
            </Link>
          ))}
          <Link href={`/transactions?${qs({ search: undefined, category: undefined, sub_category: undefined, type: undefined, owner: undefined, tax_category: undefined })}`} className="text-xs text-gray-500 hover:underline">
            Clear all
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState>No transactions match these filters.</EmptyState>
      ) : (
        <>
          <TxnList rows={rows} total={count} filter={filter} allSubCategories={allSubCategories} accountNames={accountNames} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link className="btn-ghost" href={`/transactions?${qs({ page: String(page - 1) })}`}>
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link className="btn-ghost" href={`/transactions?${qs({ page: String(page + 1) })}`}>
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
