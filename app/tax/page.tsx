import Link from "next/link";
import PeriodSelector from "@/components/PeriodSelector";
import ClaimsHistory from "@/components/ClaimsHistory";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import { getAvailablePeriods, fetchTypeTotals, fetchClaimTotals, fetchClaimEstimates, fetchTaggedClaims } from "@/lib/queries";
import { parsePeriod, periodLabel, fyLabel, EXPENSE_TYPES } from "@/lib/fy";
import { money, TYPE_COLORS } from "@/lib/format";
import { taxLabel, claimCategoryForCode } from "@/lib/taxcats";
import { CLAIMS_ESTIMATE_FY, CLAIM_CATEGORY_ORDER } from "@/lib/claimsHistory";
import { Download, ListChecks, Home } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TaxPage({
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

  // FY26 tagged claims feed the "linked transactions" view in the history table
  // (always FY26, independent of the selected period above).
  const fy26Period = parsePeriod({ period: "fy", value: String(CLAIMS_ESTIMATE_FY) });

  const [totals, claimTotals, estimates, taggedFy26] = await Promise.all([
    fetchTypeTotals(period),
    fetchClaimTotals(period),
    fetchClaimEstimates(CLAIMS_ESTIMATE_FY),
    fetchTaggedClaims(fy26Period),
  ]);

  // Group manual estimate overrides by person + category for the history table.
  const estimateOverrides: { lloyd: Record<string, number>; milani: Record<string, number> } = {
    lloyd: {},
    milani: {},
  };
  for (const e of estimates) {
    if (e.person === "lloyd" || e.person === "milani") estimateOverrides[e.person][e.category] = Number(e.amount);
  }

  const income = totals.income ?? 0;
  const expenses = EXPENSE_TYPES.reduce((s, t) => s + Math.abs(totals[t] ?? 0), 0);
  const net = income - expenses;

  // Deductions tagged as deductible, split per owner and rolled up by ATO bucket.
  const claimsByOwner = new Map<string, number>();
  const claimsByBucket = new Map<string, { lloyd: number; milani: number; total: number }>();
  let claimTotal = 0;
  for (const c of claimTotals) {
    claimTotal += c.amount;
    claimsByOwner.set(c.owner, (claimsByOwner.get(c.owner) ?? 0) + c.amount);
    const b = claimsByBucket.get(c.tax_category) ?? { lloyd: 0, milani: 0, total: 0 };
    if (c.owner === "lloyd") b.lloyd += c.amount;
    else if (c.owner === "milani") b.milani += c.amount;
    b.total += c.amount;
    claimsByBucket.set(c.tax_category, b);
  }
  // Order the ATO buckets the same way as the history table (by normalised claim
  // category), so the two tables read top-to-bottom identically; codes with no
  // claim-category mapping fall to the end. Ties break on total desc.
  const catRank = (code: string) => {
    const cc = claimCategoryForCode(code);
    const i = cc ? (CLAIM_CATEGORY_ORDER as readonly string[]).indexOf(cc) : -1;
    return i === -1 ? 999 : i;
  };
  const bucketRows = [...claimsByBucket.entries()].sort((a, b) => {
    const d = catRank(a[0]) - catRank(b[0]);
    return d !== 0 ? d : b[1].total - a[1].total;
  });

  // Link a bucket to the transactions that make it up (same period, tagged code).
  const txnHref = (code: string) => {
    const p = new URLSearchParams(effective as Record<string, string>);
    p.set("tax_category", code);
    return `/transactions?${p.toString()}`;
  };

  const exportQs = new URLSearchParams(effective as Record<string, string>);
  const claimsExportQs = new URLSearchParams(exportQs);
  claimsExportQs.set("mode", "claims");
  const claimsExportHref = `/api/export?${claimsExportQs.toString()}`;
  const claimsHref = `/tax/claims?${exportQs.toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax"
        subtitle={`FY pack · ${periodLabel(period)}`}
        actions={
          <div className="flex items-center gap-2">
            <PeriodSelector years={years} fys={fys} fallback={fys.length > 0 ? `fy:${fys[0]}` : undefined} />
            <Link href="/tax/rental" className="btn-ghost">
              <Home size={15} /> Rental schedule
            </Link>
            <Link href={claimsHref} className="btn-primary">
              <ListChecks size={15} /> Build claims
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assessable income" value={money(income)} accent={TYPE_COLORS.income} />
        <StatCard label="Total expenses" value={money(expenses)} accent={TYPE_COLORS.spending} />
        <StatCard
          label="Net position"
          value={money(net, { sign: true })}
          accent={net >= 0 ? TYPE_COLORS.income : TYPE_COLORS.spending}
        />
        <StatCard
          label="Deductions tagged"
          value={money(claimTotal)}
          accent={TYPE_COLORS.debt}
          sub={
            claimTotal > 0
              ? `Lloyd ${money(claimsByOwner.get("lloyd") ?? 0)} · Milani ${money(claimsByOwner.get("milani") ?? 0)}`
              : "None tagged yet"
          }
        />
      </div>

      {/* Deductions roll-up */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Deductions by ATO category</h2>
          <div className="ml-auto flex items-center gap-2">
            <Link href={claimsHref} className="btn-ghost !py-1 text-xs">
              <ListChecks size={14} /> Edit claims
            </Link>
            <a href={claimsExportHref} className="btn-ghost !py-1 text-xs">
              <Download size={14} /> Claims CSV
            </a>
          </div>
        </div>
        {bucketRows.length === 0 ? (
          <EmptyState>
            No deductions tagged for {periodLabel(period)}.{" "}
            <Link href={claimsHref} className="text-indigo-600 hover:underline">
              Start tagging
            </Link>
            .
          </EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="px-4 py-2 text-left font-medium">Category</th>
                <th className="px-4 py-2 text-right font-medium">Lloyd</th>
                <th className="px-4 py-2 text-right font-medium">Milani</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bucketRows.map(([code, b]) => (
                <tr key={code} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2 font-medium">
                    <Link href={txnHref(code)} className="hover:text-indigo-700 hover:underline" title="View the transactions in this bucket">
                      {taxLabel(code)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular">{b.lloyd ? money(b.lloyd) : "—"}</td>
                  <td className="px-4 py-2 text-right tabular">{b.milani ? money(b.milani) : "—"}</td>
                  <td className="px-4 py-2 text-right tabular font-semibold">{money(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Historical claims (submitted vs assessed) */}
      <ClaimsHistory estimateFy={CLAIMS_ESTIMATE_FY} initialOverrides={estimateOverrides} taggedClaims={taggedFy26} />

      <p className="text-xs text-gray-400">
        {period.kind === "fy" ? `${fyLabel(period.value!)} runs 1 Jul ${period.value! - 1} → 30 Jun ${period.value}. ` : ""}
        Figures reflect approved transactions only. Nothing is claimed automatically — deductions are the ones you tag in
        the claims builder. Not tax advice.
      </p>
    </div>
  );
}
