"use client";
import { useState } from "react";
import { CLAIMS_HISTORY, CLAIM_CATEGORY_ORDER, claimsHistoryFys, ClaimPerson } from "@/lib/claimsHistory";
import { money } from "@/lib/format";
import { fyLabel } from "@/lib/fy";
import { AlertTriangle } from "lucide-react";

const PEOPLE: { key: ClaimPerson; label: string }[] = [
  { key: "lloyd", label: "Lloyd" },
  { key: "milani", label: "Milani" },
];

export default function ClaimsHistory() {
  const [person, setPerson] = useState<ClaimPerson>("lloyd");
  const fys = claimsHistoryFys();
  const history = CLAIMS_HISTORY.find((p) => p.person === person)!;
  const byFy = new Map(history.years.map((y) => [y.fy, y]));

  const cell = (fy: number, cat: (typeof CLAIM_CATEGORY_ORDER)[number]) => byFy.get(fy)?.lines[cat] ?? 0;
  // Only show category rows that have a value in at least one year.
  const rows = CLAIM_CATEGORY_ORDER.filter((cat) => fys.some((fy) => cell(fy, cat) > 0));

  const flags = history.years.flatMap((y) => (y.flags ?? []).map((f) => ({ fy: y.fy, text: f })));

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">Claims history · submitted by category</h2>
          <p className="text-[11px] text-gray-500">From the personal workbooks given to the tax agent (FY21–FY25)</p>
        </div>
        <div className="ml-auto flex items-center gap-0.5 rounded-lg border bg-white p-0.5">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((cat) => (
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
              </tr>
            ))}
            {/* Submitted total */}
            <tr className="border-t-2 bg-gray-50/60 font-semibold">
              <td className="px-4 py-2">Total submitted</td>
              {fys.map((fy) => {
                const y = byFy.get(fy);
                return (
                  <td key={fy} className="px-4 py-2 text-right tabular">
                    {y && y.submittedTotal > 0 ? money(y.submittedTotal) : <span className="text-gray-300">—</span>}
                  </td>
                );
              })}
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
            </tr>
          </tbody>
        </table>
      </div>

      {/* Assessed outcome (ATO) */}
      <div className="border-t bg-gray-50/40 px-4 py-2">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Assessed by ATO</p>
        <table className="w-full text-sm">
          <tbody>
            {[
              { label: "Gross wages", key: "grossWages" as const },
              { label: "PAYG withheld", key: "paygWithheld" as const },
              { label: "Taxable income (assessed)", key: "taxableIncome" as const },
              { label: "Refund", key: "refund" as const },
            ].map((row) => (
              <tr key={row.key}>
                <td className="py-1 pr-4 text-gray-600">{row.label}</td>
                {fys.map((fy) => {
                  const v = byFy.get(fy)?.[row.key];
                  return (
                    <td
                      key={fy}
                      className={`py-1 pl-4 text-right tabular ${
                        row.key === "refund" && v ? "font-medium text-emerald-600" : ""
                      }`}
                    >
                      {v != null ? money(v) : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
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
        &ldquo;Submitted&rdquo; is what was given to the agent (personal workbooks). Category-level <em>as-lodged</em>{" "}
        figures from the consolidated booklets aren&rsquo;t extracted yet — where the agent lodged the workbook
        unchanged, claimed equals submitted. Figures are reference only, not tax advice.
      </p>
    </div>
  );
}
