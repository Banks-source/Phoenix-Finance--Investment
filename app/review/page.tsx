import Link from "next/link";
import TxnList from "@/components/TxnList";
import { PageHeader, EmptyState } from "@/components/ui";
import { fetchTransactions, TxnFilter } from "@/lib/queries";
import { fetchAllSubCategoryNames } from "@/lib/subCategoriesTable";
import { createServiceClient } from "@/lib/supabase/server";
import { accountName, AccountRef } from "@/lib/transferAccounts";
import { computeFlows } from "@/lib/transferFlows";
import { CATEGORIES } from "@/lib/taxonomy";
import { X } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

type SP = { search?: string; category?: string; owner?: string; page?: string };

// The Review queue is the Transactions list filtered to "to review" across all
// time — same rows, same inline edit, same bulk bar — plus approve controls.
export default async function ReviewPage({ searchParams }: { searchParams: SP }) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const filter: TxnFilter = {
    status: "pending_review",
    search: searchParams.search,
    category: searchParams.category,
    owner: searchParams.owner,
  };

  const [{ rows, count }, allSubCategories, { data: accountRows }] = await Promise.all([
    fetchTransactions({ status: filter.status, search: filter.search, category: filter.category, owner: filter.owner, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    fetchAllSubCategoryNames(),
    createServiceClient().from("accounts").select("id, institution, account_label, account_number_masked"),
  ]);
  const accounts = (accountRows ?? []) as AccountRef[];
  const accountNames: Record<string, string> = {};
  for (const a of accounts) accountNames[a.id] = accountName(a) ?? "";
  const flows = computeFlows(rows, accounts);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...searchParams, ...o })) if (v) p.set(k, v);
    return p.toString();
  };
  const hasFilters = !!(searchParams.search || searchParams.category || searchParams.owner);

  return (
    <div className="space-y-4">
      <PageHeader title="Review" subtitle={`${count.toLocaleString()} waiting for your approval`} />

      <form className="card flex flex-wrap items-end gap-2 p-3" action="/review">
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
        <button className="btn-primary" type="submit">
          Apply
        </button>
        {hasFilters && (
          <Link href="/review" className="inline-flex items-center gap-1 px-2 py-2 text-xs text-gray-500 hover:underline">
            <X size={12} /> Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState>
          {hasFilters ? "Nothing to review with these filters." : "Nothing to review — new bank transactions show up here automatically."}
        </EmptyState>
      ) : (
        <>
          <TxnList
            rows={rows}
            total={count}
            filter={filter}
            allSubCategories={allSubCategories}
            accountNames={accountNames}
            flows={flows}
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link className="btn-ghost" href={`/review?${qs({ page: String(page - 1) })}`}>
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link className="btn-ghost" href={`/review?${qs({ page: String(page + 1) })}`}>
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
