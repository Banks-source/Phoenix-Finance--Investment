import Link from "next/link";
import ClaimsQueue from "@/components/ClaimsQueue";
import PeriodSelector from "@/components/PeriodSelector";
import { PageHeader, EmptyState } from "@/components/ui";
import { getAvailablePeriods, fetchClaimCandidates, fetchCategoryTotals } from "@/lib/queries";
import { parsePeriod, periodLabel, fyLabel } from "@/lib/fy";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const OWNERS = [
  { key: "", label: "All" },
  { key: "lloyd", label: "Lloyd" },
  { key: "milani", label: "Milani" },
];

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: { period?: string; value?: string; from?: string; to?: string; owner?: string; all?: string };
}) {
  const { years, fys } = await getAvailablePeriods();

  const effective =
    !searchParams.period && fys.length > 0 ? { period: "fy", value: String(fys[0]) } : searchParams;
  const period = parsePeriod(effective);
  const owner = searchParams.owner || "";
  const showAll = searchParams.all === "1";

  const candidates = await fetchClaimCandidates(period, { owner: owner || undefined, all: showAll });

  // Prior-FY net-by-category, shown as a hint next to each group.
  const priorFy = period.kind === "fy" && period.value ? period.value - 1 : null;
  const priorLabel = priorFy ? fyLabel(priorFy) : undefined;
  const priorRows = priorFy ? await fetchCategoryTotals({ kind: "fy", value: priorFy }) : [];
  const priorByCategory: Record<string, number> = {};
  for (const r of priorRows) priorByCategory[r.category] = r.net;

  const qp = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (effective.period) p.set("period", effective.period);
    if (effective.value) p.set("value", String(effective.value));
    if (effective.from) p.set("from", effective.from);
    if (effective.to) p.set("to", effective.to);
    if (owner) p.set("owner", owner);
    if (showAll) p.set("all", "1");
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="FY claims builder"
        subtitle={`Tag deductible expenses · ${periodLabel(period)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/tax" className="btn-ghost">
              <ArrowLeft size={15} /> Tax
            </Link>
            <PeriodSelector years={years} fys={fys} fallback={fys.length > 0 ? `fy:${fys[0]}` : undefined} />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border bg-white p-0.5">
          {OWNERS.map((o) => {
            const active = owner === o.key;
            return (
              <Link
                key={o.key || "all"}
                href={qp({ owner: o.key || undefined })}
                className={`rounded-md px-3 py-1 text-sm font-medium ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {o.label}
              </Link>
            );
          })}
        </div>
        <Link
          href={qp({ all: showAll ? undefined : "1" })}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
            showAll ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          {showAll ? "Showing all expenses" : "Suggested only"}
        </Link>
        <span className="text-sm text-gray-500">{candidates.length} transactions</span>
      </div>

      {candidates.length === 0 ? (
        <EmptyState>
          No claim candidates for this period.{" "}
          {!showAll && (
            <Link href={qp({ all: "1" })} className="text-indigo-600 hover:underline">
              Show all expenses
            </Link>
          )}
        </EmptyState>
      ) : (
        <ClaimsQueue rows={candidates} priorByCategory={priorByCategory} priorLabel={priorLabel} />
      )}

      <p className="text-xs text-gray-400">
        Suggestions are hints from category mappings — nothing is claimed automatically. Prior-year figures are net
        totals for the same category, shown to help spot missed or changed deductions.
      </p>
    </div>
  );
}
