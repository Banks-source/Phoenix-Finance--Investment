"use client";
import { EXPENSE_TYPES } from "@/lib/fy";
import { TxnType } from "@/lib/taxonomy";
import { money, TYPE_COLORS, typeLabel } from "@/lib/format";

// Horizontal bar breakdown of where money went for the period.
export default function DeficitChart({ totals }: { totals: Record<string, number> }) {
  const expenses = EXPENSE_TYPES.map((t) => ({
    type: t as TxnType,
    value: Math.abs(totals[t] ?? 0),
  })).filter((e) => e.value > 0);

  const max = Math.max(1, ...expenses.map((e) => e.value));

  if (expenses.length === 0) {
    return <p className="text-sm text-gray-500">No expense data for this period.</p>;
  }

  return (
    <div className="space-y-3">
      {expenses.map((e) => (
        <div key={e.type}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium">{typeLabel(e.type)}</span>
            <span className="tabular text-gray-600">{money(e.value)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${(e.value / max) * 100}%`, backgroundColor: TYPE_COLORS[e.type] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
