"use client";
import { useMemo, useState } from "react";
import {
  CLAIMS_HISTORY,
  CLAIM_CATEGORY_ORDER,
  claimsHistoryFys,
  claimsHistoryEstimate,
  claimsRefundEstimate,
  computeReturn,
  ClaimPerson,
  ReturnComputation,
} from "@/lib/claimsHistory";
import { money } from "@/lib/format";
import { fyLabel } from "@/lib/fy";
import { AlertTriangle } from "lucide-react";

const PEOPLE: { key: ClaimPerson; label: string }[] = [
  { key: "lloyd", label: "Lloyd" },
  { key: "milani", label: "Milani" },
];

type Overrides = Record<ClaimPerson, Partial<Record<string, number>>>;
type Basis = "lodged" | "submitted";

export default function ClaimsHistory({
  estimateFy,
  initialOverrides,
}: {
  estimateFy: number;
  initialOverrides: Overrides;
}) {
  const [person, setPerson] = useState<ClaimPerson>("lloyd");
  const [basis, setBasis] = useState<Basis>("lodged");
  const [overrides, setOverrides] = useState<Overrides>(
    initialOverrides ?? { lloyd: {}, milani: {} }
  );
  const [saving, setSaving] = useState<string | null>(null);

  const fys = claimsHistoryFys();
  const history = CLAIMS_HISTORY.find((p) => p.person === person)!;
  const byFy = new Map(history.years.map((y) => [y.fy, y]));
  const computed = useMemo(() => claimsHistoryEstimate(person), [person]);

  const cell = (fy: number, cat: (typeof CLAIM_CATEGORY_ORDER)[number]) => byFy.get(fy)?.lines[cat] ?? 0;

  // Effective FY-estimate for a category = manual override, else computed suggestion.
  const effEstimate = (cat: string) => overrides[person]?.[cat] ?? computed[cat as keyof typeof computed] ?? 0;
  const estimateTotal = CLAIM_CATEGORY_ORDER.reduce((s, cat) => s + effEstimate(cat), 0);

  // Estimated FY26 outcome (seeded from the latest documented gross/PAYG).
  const refundEst = useMemo(() => claimsRefundEstimate(person, estimateTotal), [person, estimateTotal]);

  // End-to-end return for a historical FY, on the selected basis.
  // "lodged" = the assessed return (deductions implied by gross − taxable);
  // "submitted" = re-run the waterfall on the workbook deduction total.
  const yearReturn = (fy: number): ReturnComputation | null => {
    const y = byFy.get(fy);
    if (!y || y.grossWages == null) return null;
    const gross = y.grossWages;
    const payg = y.paygWithheld ?? 0;
    if (basis === "lodged") {
      if (y.taxableIncome == null) return null; // no assessment on file
      const incomeTax = y.assessedIncomeTax ?? 0;
      const medicare = y.assessedMedicare ?? 0;
      const totalTax = incomeTax + medicare;
      return {
        assessableIncome: gross,
        deductions: gross - y.taxableIncome,
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
    return computeReturn({ assessableIncome: gross, deductions: y.submittedTotal, paygWithheld: payg });
  };

  const returnByFy = new Map<number, ReturnComputation | null>(fys.map((fy) => [fy, yearReturn(fy)]));

  const waterfallRows: { label: string; key: keyof ReturnComputation; strong?: boolean; refund?: boolean }[] = [
    { label: "Assessable income", key: "assessableIncome" },
    { label: "less Deductions", key: "deductions" },
    { label: "Taxable income", key: "taxableIncome", strong: true },
    { label: "Income tax", key: "incomeTax" },
    { label: "Medicare levy", key: "medicareLevy" },
    { label: "Total tax", key: "totalTax", strong: true },
    { label: "less PAYG withheld", key: "paygWithheld" },
    { label: "Refund / (payable)", key: "refund", refund: true },
  ];

  const flags = history.years.flatMap((y) => (y.flags ?? []).map((f) => ({ fy: y.fy, text: f })));

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
            <b>Submitted</b> (workbook). {fyLabel(estimateFy)} is an editable estimate.
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
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="px-4 py-2 text-left font-medium">Deduction</th>
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
              const suggestion = computed[cat as keyof typeof computed];
              return (
                <tr key={cat} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2 font-medium">{cat}</td>
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
                      key={`${person}-${cat}`}
                      type="number"
                      min={0}
                      inputMode="decimal"
                      defaultValue={ov ?? ""}
                      placeholder={suggestion ? String(suggestion) : "0"}
                      onBlur={(e) => saveEstimate(cat, e.target.value)}
                      className={`w-24 rounded-md border px-2 py-1 text-right tabular focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 ${
                        ov != null ? "border-indigo-300 bg-indigo-50/40 font-medium text-indigo-800" : "border-gray-200"
                      } ${saving === cat ? "opacity-60" : ""}`}
                    />
                  </td>
                </tr>
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
                  return (
                    <td
                      key={fy}
                      className={`px-4 py-1 text-right tabular ${
                        row.refund && v != null ? (v >= 0 ? "text-emerald-600" : "text-rose-600") : ""
                      }`}
                    >
                      {v != null ? money(Math.round(v)) : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
                {(() => {
                  const v = refundEst ? refundEst[row.key] : undefined;
                  return (
                    <td
                      className={`px-4 py-1 text-right tabular ${
                        v == null
                          ? "text-gray-300"
                          : row.refund
                          ? v >= 0
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
        The category rows are what was <b>submitted</b> to the agent (personal workbooks). The end-to-end return shows{" "}
        <b>As lodged</b> — the assessed figures from the ATO notice (deductions implied by gross − taxable income) — or{" "}
        <b>Submitted</b>, which re-runs the waterfall on the workbook deduction total (the gap to the lodged refund is the
        rental loss / other items not in the workbook). {fyLabel(estimateFy)} uses your finalised income statement less
        your editable deductions, on the current resident scale + Medicare levy + LITO (ignores MLS, HELP, Div 293 and
        non-wage income). Rental loss is carried from FY24-25 (&minus;$71,451), pending the Ocean Grove ownership
        question. Reference only, not tax advice.
      </p>
    </div>
  );
}
