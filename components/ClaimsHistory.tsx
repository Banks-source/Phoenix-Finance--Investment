"use client";
import { Fragment, useMemo, useState } from "react";
import {
  CLAIMS_HISTORY,
  CLAIM_CATEGORY_ORDER,
  CLAIM_CATEGORY_DITEM,
  claimsHistoryFys,
  claimsHistoryEstimate,
  claimsRefundEstimate,
  computeReturn,
  ClaimPerson,
  ReturnComputation,
} from "@/lib/claimsHistory";
import { money } from "@/lib/format";
import { fyLabel } from "@/lib/fy";
import { taxLabel, claimCategoryForCode } from "@/lib/taxcats";
import type { TaggedClaim } from "@/lib/queries";
import { AlertTriangle, ChevronRight, Link2 } from "lucide-react";

const PEOPLE: { key: ClaimPerson; label: string }[] = [
  { key: "lloyd", label: "Lloyd" },
  { key: "milani", label: "Milani" },
];

type Overrides = Record<ClaimPerson, Partial<Record<string, number>>>;
type Basis = "lodged" | "submitted";

export default function ClaimsHistory({
  estimateFy,
  initialOverrides,
  taggedClaims = [],
}: {
  estimateFy: number;
  initialOverrides: Overrides;
  taggedClaims?: TaggedClaim[];
}) {
  const [person, setPerson] = useState<ClaimPerson>("lloyd");
  const [basis, setBasis] = useState<Basis>("lodged");
  const [showLinked, setShowLinked] = useState(false);
  const [overrides, setOverrides] = useState<Overrides>(
    initialOverrides ?? { lloyd: {}, milani: {} }
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (cat: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const fys = claimsHistoryFys();
  const history = CLAIMS_HISTORY.find((p) => p.person === person)!;
  const byFy = new Map(history.years.map((y) => [y.fy, y]));
  const computed = useMemo(() => claimsHistoryEstimate(person), [person]);

  const cell = (fy: number, cat: (typeof CLAIM_CATEGORY_ORDER)[number]) => byFy.get(fy)?.lines[cat] ?? 0;

  // Sub-item breakdown for a category: the union of sub-line labels across all
  // years (first-seen order), each with its per-FY amount where documented.
  const breakdownRows = (cat: (typeof CLAIM_CATEGORY_ORDER)[number]) => {
    const labels: string[] = [];
    for (const y of history.years)
      for (const b of y.breakdown?.[cat] ?? []) if (!labels.includes(b.label)) labels.push(b.label);
    return labels.map((label) => ({
      label,
      byFy: new Map(history.years.map((y) => [y.fy, (y.breakdown?.[cat] ?? []).find((b) => b.label === label)?.amount])),
    }));
  };

  // FY26 transactions tagged to this person, rolled up into the normalised claim
  // category they belong to — the auto-seed for the estimate column below.
  const taggedByCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of taggedClaims) {
      if (t.owner !== person) continue;
      const cat = claimCategoryForCode(t.tax_category);
      if (!cat) continue;
      m[cat] = (m[cat] ?? 0) + t.amount;
    }
    return m;
  }, [taggedClaims, person]);

  // Effective FY-estimate for a category = manual override, else the FY26 tagged
  // total, else the workbook-derived suggestion.
  const effEstimate = (cat: string) =>
    overrides[person]?.[cat] ?? taggedByCat[cat] ?? computed[cat as keyof typeof computed] ?? 0;
  const estimateTotal = CLAIM_CATEGORY_ORDER.reduce((s, cat) => s + effEstimate(cat), 0);

  // The rental loss is an income component (a negative net-rent line), not a
  // work-related deduction — split it out so it flows through the return.
  const RENTAL_CAT = "Rental loss (negative gearing)";
  const rentalLossEst = effEstimate(RENTAL_CAT); // positive dollar loss
  const workDeductionsEst = CLAIM_CATEGORY_ORDER.filter((c) => c !== RENTAL_CAT).reduce(
    (s, cat) => s + effEstimate(cat),
    0
  );

  // Estimated FY26 outcome (seeded from the latest documented gross/PAYG).
  const refundEst = useMemo(
    () => claimsRefundEstimate(person, workDeductionsEst, -rentalLossEst),
    [person, workDeductionsEst, rentalLossEst]
  );

  // End-to-end return for a historical FY, on the selected basis.
  // "lodged" = the assessed return, decomposed into salary + net rent + a
  //   reconciling other-income line so it foots to the ATO-assessed taxable
  //   income; "submitted" = re-run the waterfall on the workbook deductions only.
  const yearReturn = (fy: number): ReturnComputation | null => {
    const y = byFy.get(fy);
    if (!y || y.grossWages == null) return null;
    const gross = y.grossWages;
    const payg = y.paygWithheld ?? 0;
    if (basis === "lodged") {
      if (y.taxableIncome == null) return null; // no assessment on file
      const netRental = y.netRental ?? 0;
      const deductions = y.submittedTotal; // documented work-related deductions
      // Residual income needed to reconcile the documented lines to the assessment.
      const otherIncome = y.taxableIncome + deductions - gross - netRental;
      const incomeTax = y.assessedIncomeTax ?? 0;
      const medicare = y.assessedMedicare ?? 0;
      const totalTax = incomeTax + medicare;
      return {
        salaryWages: gross,
        netRental,
        otherIncome,
        assessableIncome: gross + netRental + otherIncome,
        deductions,
        taxableIncome: y.taxableIncome,
        incomeTax,
        lito: 0,
        netIncomeTax: incomeTax,
        medicareLevy: medicare,
        totalTax,
        paygWithheld: payg,
        refund: y.refund ?? payg - totalTax,
      };
    }
    return computeReturn({ salaryWages: gross, deductions: y.submittedTotal, paygWithheld: payg });
  };

  const returnByFy = new Map<number, ReturnComputation | null>(fys.map((fy) => [fy, yearReturn(fy)]));

  const allReturns = [...returnByFy.values(), refundEst].filter(Boolean) as ReturnComputation[];
  const hasValue = (key: keyof ReturnComputation) => allReturns.some((r) => Math.round(r[key]) !== 0);

  const waterfallRows: {
    label: string;
    key: keyof ReturnComputation;
    strong?: boolean;
    refund?: boolean;
    optional?: boolean;
  }[] = (
    [
      { label: "Salary & wages", key: "salaryWages" },
      { label: "Net rent (loss)", key: "netRental", optional: true },
      { label: "Other income / adj.", key: "otherIncome", optional: true },
      { label: "Assessable income", key: "assessableIncome", strong: true },
      { label: "less Work-related deductions", key: "deductions" },
      { label: "Taxable income", key: "taxableIncome", strong: true },
      { label: "Income tax", key: "incomeTax" },
      { label: "less Low income tax offset", key: "lito", optional: true },
      { label: "Medicare levy", key: "medicareLevy" },
      { label: "Total tax", key: "totalTax", strong: true },
      { label: "less PAYG withheld", key: "paygWithheld" },
      { label: "Refund / (payable)", key: "refund", refund: true },
    ] as { label: string; key: keyof ReturnComputation; strong?: boolean; refund?: boolean; optional?: boolean }[]
  ).filter((r) => !r.optional || hasValue(r.key));

  const flags = history.years.flatMap((y) => (y.flags ?? []).map((f) => ({ fy: y.fy, text: f })));

  // FY26 transactions tagged to the selected person, grouped by ATO code — the
  // live "linked" basis behind the editable estimate. Revealed by the toggle.
  const linkedGroups = useMemo(() => {
    const mine = taggedClaims.filter((t) => t.owner === person);
    const m = new Map<string, { code: string; total: number; items: TaggedClaim[] }>();
    for (const t of mine) {
      const g = m.get(t.tax_category) ?? { code: t.tax_category, total: 0, items: [] };
      g.total += t.amount;
      g.items.push(t);
      m.set(t.tax_category, g);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [taggedClaims, person]);
  const linkedTotal = linkedGroups.reduce((s, g) => s + g.total, 0);

  async function saveEstimate(cat: string, raw: string) {
    const trimmed = raw.trim();
    const amount = trimmed === "" ? null : Number(trimmed);
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) return;
    setSaving(cat);
    try {
      await fetch("/api/claim-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person, fy: estimateFy, category: cat, amount }),
      });
      setOverrides((prev) => {
        const next = { ...prev, [person]: { ...prev[person] } };
        if (amount == null) delete next[person][cat];
        else next[person][cat] = amount;
        return next;
      });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">Personal return · deductions & end-to-end refund</h2>
          <p className="text-[11px] text-gray-500">
            Deductions by category, then the full return to the refund. Toggle <b>As lodged</b> (assessed) vs{" "}
            <b>Submitted</b> (workbook). {fyLabel(estimateFy)} is an editable estimate \u2014{" "}
            <span className="text-emerald-700">green</span> cells are auto-summed from tagged transactions,{" "}
            <span className="text-indigo-700">indigo</span> are manual overrides.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border bg-white p-0.5">
            {PEOPLE.map((p) => (
              <button
                key={p.key}
                onClick={() => setPerson(p.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  person === p.key ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border bg-white p-0.5" title="Basis for the return breakdown below">
            {(
              [
                { key: "lodged", label: "As lodged" },
                { key: "submitted", label: "Submitted" },
              ] as { key: Basis; label: string }[]
            ).map((b) => (
              <button
                key={b.key}
                onClick={() => setBasis(b.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  basis === b.key ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowLinked((v) => !v)}
            title="Show the FY26 transactions tagged to this person that feed the estimate"
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              showLinked ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Link2 size={14} /> Linked claims
            {linkedGroups.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-1.5 text-[10px] text-indigo-700">{money(linkedTotal)}</span>
            )}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="px-4 py-2 text-left font-medium">Deduction · ATO item</th>
              {fys.map((fy) => (
                <th key={fy} className="px-4 py-2 text-right font-medium">
                  {fyLabel(fy)}
                </th>
              ))}
              <th className="px-4 py-2 text-right font-medium text-indigo-600">{fyLabel(estimateFy)} · est.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {CLAIM_CATEGORY_ORDER.map((cat) => {
              const ov = overrides[person]?.[cat];
              const tagged = taggedByCat[cat];
              const suggestion = computed[cat as keyof typeof computed];
              // Value shown in the est cell when there's no manual override: the
              // FY26 tagged total (rounded), else blank (placeholder shows suggestion).
              const autoValue = tagged != null ? Math.round(tagged) : undefined;
              const subRows = breakdownRows(cat);
              const isOpen = expanded.has(cat);
              return (
                <Fragment key={cat}>
                  <tr className="hover:bg-gray-50/60">
                    <td className="px-4 py-2 font-medium">
                      <span className="mr-2 inline-block w-14 shrink-0 rounded bg-gray-100 px-1 py-0.5 text-center font-mono text-[10px] font-medium text-gray-500">
                        {CLAIM_CATEGORY_DITEM[cat]}
                      </span>
                      {subRows.length > 0 ? (
                        <button
                          onClick={() => toggleExpanded(cat)}
                          className="inline-flex items-center gap-1 rounded hover:text-indigo-700"
                          title={isOpen ? "Hide breakdown" : "Show breakdown"}
                        >
                          <ChevronRight
                            size={13}
                            className={`shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                          />
                          {cat}
                        </button>
                      ) : (
                        cat
                      )}
                    </td>
                    {fys.map((fy) => {
                      const v = cell(fy, cat);
                      return (
                        <td key={fy} className="px-4 py-2 text-right tabular">
                          {v > 0 ? money(v) : <span className="text-gray-300">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right">
                      <input
                        key={`${person}-${cat}-${ov ?? ""}-${autoValue ?? ""}`}
                        type="number"
                        min={0}
                        inputMode="decimal"
                        defaultValue={ov ?? autoValue ?? ""}
                        placeholder={suggestion ? String(suggestion) : "0"}
                        onBlur={(e) => saveEstimate(cat, e.target.value)}
                        title={
                          ov != null
                            ? "Manual override — type to change"
                            : tagged != null
                            ? `Auto from ${money(tagged)} of tagged FY26 transactions — type to override`
                            : "Estimate — type to override"
                        }
                        className={`w-24 rounded-md border px-2 py-1 text-right tabular focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 ${
                          ov != null
                            ? "border-indigo-300 bg-indigo-50/40 font-medium text-indigo-800"
                            : tagged != null
                            ? "border-emerald-200 bg-emerald-50/30 font-medium text-emerald-800"
                            : "border-gray-200"
                        } ${saving === cat ? "opacity-60" : ""}`}
                      />
                    </td>
                  </tr>
                  {isOpen &&
                    subRows.map((br) => (
                      <tr key={`${cat}-${br.label}`} className="text-xs text-gray-500">
                        <td className="py-1 pl-[5.5rem] pr-4">{br.label}</td>
                        {fys.map((fy) => {
                          const v = br.byFy.get(fy);
                          return (
                            <td key={fy} className="px-4 py-1 text-right tabular">
                              {v != null ? money(v) : <span className="text-gray-300">—</span>}
                            </td>
                          );
                        })}
                        <td className="px-4 py-1 text-right text-gray-300">—</td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
            {/* Totals */}
            <tr className="border-t-2 bg-gray-50/60 font-semibold">
              <td className="px-4 py-2">Total</td>
              {fys.map((fy) => {
                const y = byFy.get(fy);
                return (
                  <td key={fy} className="px-4 py-2 text-right tabular">
                    {y && y.submittedTotal > 0 ? money(y.submittedTotal) : <span className="text-gray-300">—</span>}
                  </td>
                );
              })}
              <td className="px-4 py-2 text-right tabular text-indigo-700">{money(estimateTotal)}</td>
            </tr>
            {/* Method-basis metrics */}
            <tr className="text-xs text-gray-500">
              <td className="px-4 py-1.5">Work-from-home hours</td>
              {fys.map((fy) => {
                const h = byFy.get(fy)?.wfhHours;
                return (
                  <td key={fy} className="px-4 py-1.5 text-right tabular">
                    {h ? `${h.toLocaleString()} hrs` : "—"}
                  </td>
                );
              })}
              <td className="px-4 py-1.5 text-right text-gray-300">—</td>
            </tr>
            <tr className="text-xs text-gray-500">
              <td className="px-4 py-1.5">Car (logbook / km)</td>
              {fys.map((fy) => {
                const k = byFy.get(fy)?.carKm;
                return (
                  <td key={fy} className="px-4 py-1.5 text-right tabular">
                    {k ? `${k.toLocaleString()} km` : "—"}
                  </td>
                );
              })}
              <td className="px-4 py-1.5 text-right text-gray-300">—</td>
            </tr>
            {/* End-to-end return — same table so columns stay aligned */}
            <tr>
              <td
                colSpan={fys.length + 2}
                className="border-t-2 px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500"
              >
                End-to-end return · {basis === "lodged" ? "as lodged (assessed)" : "on submitted deductions"}
                {refundEst && (
                  <span className="ml-1 font-normal normal-case text-indigo-600">
                    · {fyLabel(estimateFy)} estimated{" "}
                    {refundEst.isActual
                      ? `(using ${fyLabel(refundEst.basisFy)} income statement)`
                      : `(from ${fyLabel(refundEst.basisFy)} income)`}
                  </span>
                )}
              </td>
            </tr>
            {waterfallRows.map((row) => (
              <tr
                key={row.key}
                className={`text-sm ${row.strong ? "bg-gray-50/60 font-semibold" : ""} ${
                  row.refund ? "border-t bg-emerald-50/30 font-semibold" : ""
                }`}
              >
                <td className={`px-4 py-1 ${row.strong || row.refund ? "" : "text-gray-600"}`}>{row.label}</td>
                {fys.map((fy) => {
                  const r = returnByFy.get(fy);
                  const v = r ? r[row.key] : undefined;
                  const signed = row.refund || row.key === "netRental" || row.key === "otherIncome";
                  return (
                    <td
                      key={fy}
                      className={`px-4 py-1 text-right tabular ${
                        signed && v != null && v !== 0 ? (v > 0 ? "text-emerald-600" : "text-rose-600") : ""
                      }`}
                    >
                      {v != null ? money(Math.round(v)) : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
                {(() => {
                  const v = refundEst ? refundEst[row.key] : undefined;
                  const signed = row.refund || row.key === "netRental" || row.key === "otherIncome";
                  return (
                    <td
                      className={`px-4 py-1 text-right tabular ${
                        v == null
                          ? "text-gray-300"
                          : signed && v !== 0
                          ? v > 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                          : "text-indigo-700"
                      }`}
                    >
                      {v != null ? money(Math.round(v)) : "—"}
                    </td>
                  );
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showLinked && (
        <div className="border-t bg-indigo-50/30 px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-700">
            <Link2 size={14} className="text-indigo-600" />
            {fyLabel(estimateFy)} linked claims · {PEOPLE.find((p) => p.key === person)?.label}
            <span className="ml-auto tabular text-indigo-700">{money(linkedTotal)} tagged</span>
          </div>
          {linkedGroups.length === 0 ? (
            <p className="text-xs text-gray-500">
              No {fyLabel(estimateFy)} transactions tagged to {PEOPLE.find((p) => p.key === person)?.label} yet. Tag them
              in the claims builder — assign the person and an ATO sub-category (D5, D2…) and they&rsquo;ll appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {linkedGroups.map((g) => (
                <details key={g.code} className="rounded-lg border bg-white">
                  <summary className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs">
                    <ChevronRight size={12} className="shrink-0 text-gray-400" />
                    <span className="font-mono text-[10px] text-gray-400">{g.code}</span>
                    <span className="font-medium">{taxLabel(g.code)}</span>
                    <span className="text-gray-400">
                      {g.items.length} {g.items.length === 1 ? "txn" : "txns"}
                    </span>
                    <span className="ml-auto tabular font-semibold">{money(g.total)}</span>
                  </summary>
                  <div className="divide-y divide-gray-100 border-t">
                    {g.items.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                        <span className="w-20 shrink-0 text-gray-400 tabular">{t.date}</span>
                        <span className="min-w-0 flex-1 truncate">{t.merchant}</span>
                        <span className="tabular text-gray-600">{money(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-gray-400">
            These are the actual FY26 transactions you tagged (deductible, by ATO sub-category). The editable{" "}
            {fyLabel(estimateFy)} column above is your estimate/override — it stays linked to these so you can reconcile
            the two.
          </p>
        </div>
      )}

      {flags.length > 0 && (
        <div className="space-y-1.5 border-t bg-amber-50/50 px-4 py-3">
          {flags.map((f, i) => (
            <p key={i} className="flex gap-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold">{fyLabel(f.fy)}:</span> {f.text}
              </span>
            </p>
          ))}
        </div>
      )}

      <p className="border-t px-4 py-2 text-[11px] text-gray-400">
        The category rows are what was <b>submitted</b> to the agent (personal workbooks). The end-to-end return breaks
        income into <b>salary &amp; wages</b>, <b>net rent</b> (a loss shows in red — Lloyd FY24-25 lodged a supplementary
        loss of &minus;$58,317; the Ocean Grove P&amp;L in OG.xlsx is &minus;$71,451) and <b>other income</b>. On the{" "}
        <b>As lodged</b> basis the other-income line is the residual needed to reconcile the documented wages and rental loss to the ATO-assessed taxable income
        (likely interest/distributions not itemised here); <b>Submitted</b> re-runs the waterfall on the workbook
        deductions only, so the rental loss is excluded and the gap to the lodged refund is visible.{" "}
        {fyLabel(estimateFy)} carries the rental loss forward as an editable estimate and taxes salary less deductions on
        the current resident scale + Medicare levy + LITO (ignores MLS, HELP, Div 293 and non-wage income). The Ocean
        Grove loss depends on the property sitting on Lloyd&rsquo;s personal return (Inalaa Pty Ltd ownership unresolved).
        Reference only, not tax advice.
      </p>
    </div>
  );
}
