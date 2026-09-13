"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { Pencil } from "lucide-react";

export interface BudgetRow {
  category: string;
  type: string;
  budget: number;
  isDefault: boolean; // true if this is the YTD-average default, not a saved override
  spent: number; // this calendar month so far
}

export default function BudgetTable({ rows, periodLabel = "this month" }: { rows: BudgetRow[]; periodLabel?: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function save(category: string, value: string) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      setEditing(null);
      return;
    }
    setSaving(category);
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, monthly_target: amount }),
    });
    setEditing(null);
    setSaving(null);
    router.refresh();
  }

  return (
    <div className="card divide-y divide-gray-100">
      {rows.map((r) => {
        const pct = r.budget > 0 ? Math.round((r.spent / r.budget) * 100) : 0;
        const over = r.budget > 0 && r.spent > r.budget;
        return (
          <div key={r.category} className="flex items-center gap-4 px-4 py-3">
            <div className="w-40 shrink-0 truncate font-medium">{r.category}</div>

            <div className="flex-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, pct)}%`, backgroundColor: over ? "#e11d48" : "#4f46e5" }}
                />
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {money(r.spent)} of {money(r.budget)} {periodLabel} ({pct}%)
              </div>
            </div>

            <div className="w-32 shrink-0 text-right">
              {editing === r.category ? (
                <input
                  type="number"
                  className="input w-28 text-right text-sm"
                  autoFocus
                  defaultValue={r.budget}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save(r.category, (e.target as HTMLInputElement).value);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  onBlur={(e) => save(r.category, e.target.value)}
                />
              ) : (
                <button
                  onClick={() => setEditing(r.category)}
                  className="group inline-flex items-center gap-1 text-sm"
                  disabled={saving === r.category}
                >
                  <span className="tabular font-medium">{money(r.budget)}</span>
                  <span className="text-[10px] text-gray-400">{r.isDefault ? "avg" : ""}</span>
                  <Pencil size={11} className="text-gray-300 group-hover:text-gray-500" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
