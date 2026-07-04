"use client";
import { useState } from "react";
import {
  RENTAL_HISTORY,
  RENTAL_EXPENSE_ORDER,
  RentalProperty,
  rentalExpenseTotal,
  rentalNetRent,
} from "@/lib/rentalHistory";
import { money } from "@/lib/format";
import { fyLabel } from "@/lib/fy";
import { AlertTriangle, Home } from "lucide-react";

export default function RentalSchedule() {
  const [property, setProperty] = useState<RentalProperty>("ashby");
  const prop = RENTAL_HISTORY.find((p) => p.property === property)!;
  const years = [...prop.years].sort((a, b) => a.fy - b.fy);

  // Only show expense lines that have a value in at least one year.
  const expenseLines = RENTAL_EXPENSE_ORDER.filter((line) =>
    years.some((y) => (y.expenses[line] ?? 0) !== 0)
  );

  const flags = years.flatMap((y) => (y.flags ?? []).map((f) => ({ fy: y.fy, text: f })));

  const amt = (v: number | undefined | null, expense = false) =>
    v == null || v === 0 ? (
      <span className="text-gray-300">—</span>
    ) : expense ? (
      <span>({money(v)})</span>
    ) : (
      money(v)
    );

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">Rental schedule · net rent by year</h2>
          <p className="text-[11px] text-gray-500">
            Rent income less deductible expenses. A negative net rent is a deductible loss (negative gearing).
          </p>
        </div>
        <div className="ml-auto flex items-center gap-0.5 rounded-lg border bg-white p-0.5">
          {RENTAL_HISTORY.map((p) => (
            <button
              key={p.property}
              onClick={() => setProperty(p.property)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                property === p.property ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b bg-white px-4 py-2 text-[11px] text-gray-500">
        <Home size={13} className="text-gray-400" />
        <span className="font-medium text-gray-700">{prop.address}</span>
        <span className="text-gray-300">·</span>
        <span>{prop.owners}</span>
        {prop.note && (
          <>
            <span className="text-gray-300">·</span>
            <span>{prop.note}</span>
          </>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="px-4 py-2 text-left font-medium">Line item</th>
              {years.map((y) => (
                <th key={y.fy} className="px-4 py-2 text-right font-medium">
                  {fyLabel(y.fy)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="hover:bg-gray-50/60">
              <td className="px-4 py-2 font-medium">Rent income</td>
              {years.map((y) => (
                <td key={y.fy} className="px-4 py-2 text-right tabular">
                  {amt(y.rentIncome)}
                </td>
              ))}
            </tr>

            {expenseLines.map((line) => (
              <tr key={line} className="hover:bg-gray-50/60">
                <td className="px-4 py-2 pl-8 text-gray-600">less {line}</td>
                {years.map((y) => (
                  <td key={y.fy} className="px-4 py-2 text-right tabular text-gray-600">
                    {amt(y.expenses[line], true)}
                  </td>
                ))}
              </tr>
            ))}

            <tr className="border-t bg-gray-50/40">
              <td className="px-4 py-2 pl-8 text-gray-600">Total expenses</td>
              {years.map((y) => {
                const t = rentalExpenseTotal(y);
                return (
                  <td key={y.fy} className="px-4 py-2 text-right tabular text-gray-600">
                    {t === 0 ? <span className="text-gray-300">—</span> : <span>({money(t)})</span>}
                  </td>
                );
              })}
            </tr>

            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <td className="px-4 py-2">Net rent</td>
              {years.map((y) => {
                const net = rentalNetRent(y);
                if (net == null)
                  return (
                    <td key={y.fy} className="px-4 py-2 text-right tabular text-gray-400" title="Expenses not fully reconciled">
                      n/a
                    </td>
                  );
                return (
                  <td
                    key={y.fy}
                    className={`px-4 py-2 text-right tabular ${net < 0 ? "text-rose-600" : "text-emerald-600"}`}
                  >
                    {net < 0 ? `(${money(-net)})` : money(net)}
                  </td>
                );
              })}
            </tr>

            {years.some((y) => !y.expensesComplete) && (
              <tr>
                <td colSpan={years.length + 1} className="px-4 py-1.5 text-[11px] text-amber-600">
                  Columns marked <b>n/a</b> only have agent-side rent/fees captured — interest and other expenses for
                  those years are not yet reconciled, so the net loss will be larger than shown.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {flags.length > 0 && (
        <div className="space-y-1.5 border-t bg-amber-50/40 px-4 py-3">
          {flags.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-amber-800">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
              <span>
                <b className="font-mono">{fyLabel(f.fy)}</b> — {f.text}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t px-4 py-2 text-[11px] text-gray-400">
        Reference only — figures are extracted from property workbooks and agent folio summaries. Confirm against the
        lodged rental schedule before relying on them.
      </div>
    </div>
  );
}
