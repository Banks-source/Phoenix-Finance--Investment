"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Txn } from "@/lib/queries";
import { CATEGORIES } from "@/lib/taxonomy";
import { money } from "@/lib/format";
import { TypeBadge } from "@/components/ui";
import { Pencil, X } from "lucide-react";

export default function TransactionsTable({ rows, allSubCategories = [] }: { rows: Txn[]; allSubCategories?: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState("");
  const [bulkSub, setBulkSub] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function applyBulk(body: Record<string, unknown>) {
    if (!selected.size) return;
    setBulkBusy(true);
    setBulkError(null);
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], keepStatus: true, ...body }),
    });
    setBulkBusy(false);
    if (!res.ok) {
      setBulkError("Couldn't update those transactions — try again.");
      return;
    }
    setSelected(new Set());
    setBulkCat("");
    setBulkSub("");
    startTransition(() => router.refresh());
  }

  const knownSubs = useMemo(
    () =>
      [...new Set([...allSubCategories, ...rows.map((r) => r.sub_category).filter((s): s is string => !!s)])].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      ),
    [rows, allSubCategories]
  );

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

  async function saveSubCategory(id: string, sub_category: string) {
    setSavingId(id);
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, sub_category: sub_category || null, keepStatus: true }),
    });
    setEditingSub(null);
    setSavingId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="card overflow-hidden">
      <datalist id="txn-known-subs">
        {knownSubs.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-indigo-50 px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <select className="select text-sm" value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}>
            <option value="">Change category…</option>
            {CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            className="btn-ghost"
            disabled={!bulkCat || bulkBusy}
            onClick={() => applyBulk({ category: bulkCat, sub_category: bulkSub.trim() || null })}
            title="Sets the category (and the sub-category if you've typed one; otherwise clears it)"
          >
            Apply category
          </button>
          <input
            className="input w-44 text-sm"
            list="txn-known-subs"
            placeholder="Sub-category…"
            value={bulkSub}
            onChange={(e) => setBulkSub(e.target.value)}
          />
          <button
            className="btn-ghost"
            disabled={!bulkSub.trim() || bulkBusy}
            onClick={() => applyBulk({ sub_category: bulkSub.trim() })}
          >
            Apply sub-category
          </button>
          <button className="btn-ghost ml-auto" onClick={() => setSelected(new Set())} title="Clear selection">
            <X size={14} /> Clear
          </button>
          {bulkError && <span className="w-full text-xs text-rose-600">{bulkError}</span>}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="w-8 px-4 py-2.5">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allSelected}
                onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
              />
            </th>
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="px-4 py-2.5 font-medium">Detail</th>
            <th className="px-4 py-2.5 font-medium">Owner</th>
            <th className="px-4 py-2.5 font-medium">Category</th>
            <th className="px-4 py-2.5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((t) => (
            <tr key={t.id} className={`${savingId === t.id ? "opacity-50" : ""} ${selected.has(t.id) ? "bg-indigo-50/40" : ""}`}>
              <td className="w-8 px-4 py-2.5">
                <input type="checkbox" aria-label="Select transaction" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
              </td>
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
                {editingSub === t.id ? (
                  <input
                    className="input mt-0.5 w-40 text-xs"
                    list="txn-known-subs"
                    autoFocus
                    defaultValue={t.sub_category ?? ""}
                    placeholder="Sub-category…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingSub(null);
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (t.sub_category ?? "")) saveSubCategory(t.id, v);
                      else setEditingSub(null);
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingSub(t.id)}
                    className={`group mt-0.5 flex items-center gap-1 text-xs ${
                      t.sub_category === "External transfer" ? "text-amber-600" : "text-gray-400"
                    }`}
                    title="Change sub-category"
                  >
                    {t.sub_category ?? "+ sub-category"}
                    <Pencil size={10} className="text-gray-300 group-hover:text-gray-500" />
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
