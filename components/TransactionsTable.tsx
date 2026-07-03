"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Txn } from "@/lib/queries";
import { CATEGORIES } from "@/lib/taxonomy";
import { money } from "@/lib/format";
import { TypeBadge } from "@/components/ui";
import { Pencil } from "lucide-react";

export default function TransactionsTable({ rows }: { rows: Txn[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  async function saveCategory(id: string, category: string) {
    setSavingId(id);
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, category, keepStatus: true }),
    });
    setEditing(null);
    setSavingId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="px-4 py-2.5 font-medium">Detail</th>
            <th className="px-4 py-2.5 font-medium">Owner</th>
            <th className="px-4 py-2.5 font-medium">Category</th>
            <th className="px-4 py-2.5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((t) => (
            <tr key={t.id} className={savingId === t.id ? "opacity-50" : ""}>
              <td className="whitespace-nowrap px-4 py-2.5 text-gray-600 tabular">{t.date}</td>
              <td className="max-w-xs px-4 py-2.5">
                <div className="truncate font-medium">{t.merchant || t.detail}</div>
                {t.merchant && t.detail && t.detail !== t.merchant && (
                  <div className="truncate text-xs text-gray-400">{t.detail}</div>
                )}
              </td>
              <td className="px-4 py-2.5 capitalize text-gray-600">{t.owner}</td>
              <td className="px-4 py-2.5">
                {editing === t.id ? (
                  <select
                    className="select text-xs"
                    defaultValue={t.category ?? ""}
                    autoFocus
                    onChange={(e) => saveCategory(t.id, e.target.value)}
                    onBlur={() => setEditing(null)}
                  >
                    <option value="" disabled>
                      Choose…
                    </option>
                    {CATEGORIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => setEditing(t.id)}
                    className="group inline-flex items-center gap-1.5"
                    title="Change category"
                  >
                    <TypeBadge type={t.type} />
                    <span className="text-gray-600">{t.category ?? "—"}</span>
                    <Pencil size={12} className="text-gray-300 group-hover:text-gray-500" />
                  </button>
                )}
              </td>
              <td className={`whitespace-nowrap px-4 py-2.5 text-right tabular font-medium ${t.amount < 0 ? "text-gray-900" : "text-emerald-600"}`}>
                {money(t.amount, { decimals: true, sign: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pending && <div className="border-t px-4 py-2 text-xs text-gray-400">Updating…</div>}
    </div>
  );
}
