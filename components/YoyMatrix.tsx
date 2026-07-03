"use client";
import { useMemo, useState } from "react";
import { YoyRow } from "@/lib/queries";
import { money } from "@/lib/format";
import { fyLabel } from "@/lib/fy";
import { TypeBadge } from "@/components/ui";

type OwnerKey = "all" | "lloyd" | "milani" | "joint";
const OWNERS: { key: OwnerKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "lloyd", label: "Lloyd" },
  { key: "milani", label: "Milani" },
  { key: "joint", label: "Joint" },
];

export default function YoyMatrix({ rows, fys }: { rows: YoyRow[]; fys: number[] }) {
  const [owner, setOwner] = useState<OwnerKey>("all");
  const [deductibleOnly, setDeductibleOnly] = useState(false);
  const cols = useMemo(() => [...fys].sort((a, b) => a - b), [fys]);
  const latest = cols[cols.length - 1];
  const prev = cols[cols.length - 2];

  const cellVal = (r: YoyRow, fy: number) => {
    const c = r.byFy[fy];
    if (!c) return 0;
    return owner === "all" ? c.all : owner === "lloyd" ? c.lloyd : owner === "milani" ? c.milani : c.joint;
  };

  const visible = useMemo(() => {
    const filtered = deductibleOnly ? rows.filter((r) => r.deductibleLens) : rows;
    return filtered
      .map((r) => ({ r, latestVal: cellVal(r, latest) }))
      .filter((x) => cols.some((fy) => cellVal(x.r, fy) !== 0))
      .sort((a, b) => Math.abs(b.latestVal) - Math.abs(a.latestVal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, deductibleOnly, owner, cols, latest]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 px-4 py-2.5">
        <h2 className="text-sm font-semibold">Category · year over year</h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border bg-white p-0.5">
            {OWNERS.map((o) => (
              <button
                key={o.key}
                onClick={() => setOwner(o.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  owner === o.key ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setDeductibleOnly((v) => !v)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              deductibleOnly ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Deductible only
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="px-4 py-2 text-left font-medium">Category</th>
              {cols.map((fy) => (
                <th key={fy} className="px-4 py-2 text-right font-medium">
                  {fyLabel(fy)}
                </th>
              ))}
              <th className="px-4 py-2 text-right font-medium">Δ vs {prev ? fyLabel(prev) : "prior"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map(({ r }) => {
              const latestV = cellVal(r, latest);
              const prevV = prev ? cellVal(r, prev) : 0;
              const delta = latestV - prevV;
              return (
                <tr key={r.category} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <TypeBadge type={r.type} />
                      <span className="font-medium">{r.category}</span>
                    </span>
                  </td>
                  {cols.map((fy) => {
                    const v = cellVal(r, fy);
                    return (
                      <td key={fy} className={`px-4 py-2 text-right tabular ${fy === latest ? "font-semibold" : ""}`}>
                        {v === 0 ? <span className="text-gray-300">—</span> : money(v, { sign: true })}
                      </td>
                    );
                  })}
                  <td
                    className={`px-4 py-2 text-right tabular font-medium ${
                      delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-gray-300"
                    }`}
                  >
                    {delta === 0 ? "—" : money(delta, { sign: true })}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={cols.length + 2} className="px-4 py-8 text-center text-sm text-gray-400">
                  No categories match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t px-4 py-2 text-[11px] text-gray-400">
        FY{String(latest).slice(2)} is in progress — amounts are net (income positive, spend negative). Deductible-only
        uses category→ATO-bucket mapping, not per-transaction tagging.
      </p>
    </div>
  );
}
