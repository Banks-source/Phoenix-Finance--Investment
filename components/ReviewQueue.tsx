"use client";
import { useState } from "react";
import { CATEGORIES } from "@/lib/taxonomy";

interface PendingTxn {
  id: string;
  date: string;
  amount: number;
  merchant: string;
  detail: string;
  category: string;
  sub_category: string | null;
  type: string;
}

export default function ReviewQueue({ items }: { items: PendingTxn[] }) {
  const [rows, setRows] = useState(items);
  const [pending, setPending] = useState<string | null>(null);

  async function approve(id: string, category: string) {
    if (!category) return;
    setPending(id);
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, category }),
    });
    setPending(null);
    if (res.ok) {
      setRows((r) => r.filter((row) => row.id !== id));
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">Review queue is empty.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-3 rounded-lg border border-neutral-800 p-3 text-sm">
          <div className="flex-1">
            <div className="font-medium">{row.merchant || row.detail}</div>
            <div className="text-neutral-500">
              {row.date} · ${row.amount}
            </div>
          </div>
          <select
            defaultValue=""
            disabled={pending === row.id}
            onChange={(e) => approve(row.id, e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 disabled:opacity-50"
          >
            <option value="">Choose category…</option>
            {CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
