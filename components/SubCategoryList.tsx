"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CATEGORIES, NO_SUB_CATEGORY } from "@/lib/taxonomy";
import { money } from "@/lib/format";
import { X } from "lucide-react";

export interface SubRow {
  /** Display name ("Uncategorised" for rows with no sub-category). */
  name: string;
  /** Value to filter on — NO_SUB_CATEGORY for rows with none. */
  key: string;
  net: number;
  count: number;
  href: string;
}

// Sub-categories inside one category, with bulk rename / merge / move. Edits go
// through the same /api/review endpoint as every transaction list, targeting
// "every transaction in this category + sub-category" (any status).
export default function SubCategoryList({
  category,
  rows,
  scope,
  knownSubs,
}: {
  category: string;
  rows: SubRow[];
  /** The period the page is showing, so "this period" edits match what you see. */
  scope: { period?: string; value?: string; from?: string; to?: string };
  knownSubs: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rename, setRename] = useState("");
  const [move, setMove] = useState("");
  const [allTime, setAllTime] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net)));

  function toggle(key: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  async function run(change: (r: SubRow) => Record<string, unknown>, summary: string) {
    const chosen = rows.filter((r) => selected.has(r.key));
    const txns = chosen.reduce((s, r) => s + r.count, 0);
    const where = allTime ? "all time" : "the period shown";
    if (!window.confirm(`${summary}\n\nThis changes every transaction in ${chosen.length} sub-categor${chosen.length === 1 ? "y" : "ies"} for ${where} (about ${txns.toLocaleString()} approved, plus any still in review).`)) return;
    setBusy(true);
    setMessage(null);
    let failed = false;
    for (const r of chosen) {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter: { category, sub_category: r.key, ...(allTime ? {} : scope) },
          keepStatus: true,
          ...change(r),
        }),
      });
      if (!res.ok) failed = true;
    }
    setBusy(false);
    if (failed) return setMessage({ text: "Some changes didn't save — refresh to see what changed.", error: true });
    setMessage({ text: summary });
    setSelected(new Set());
    setRename("");
    setMove("");
    startTransition(() => router.refresh());
  }

  const renameTo = rename.trim();
  return (
    <div className="space-y-3">
      <datalist id="subcat-known">
        {knownSubs.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {message && (
        <div className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${message.error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}>
          <span className="flex-1">{message.text}</span>
          <button aria-label="Dismiss" onClick={() => setMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="card divide-y divide-gray-100">
        {rows.map((r) => (
          <div key={r.key} className={`flex items-center gap-3 px-4 py-3 ${selected.has(r.key) ? "bg-indigo-50/40" : ""}`}>
            <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.key)} onChange={() => toggle(r.key)} />
            <Link href={r.href} className="flex min-w-0 flex-1 items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.name}</div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(Math.abs(r.net) / maxAbs) * 100}%`, backgroundColor: r.net < 0 ? "#e11d48" : "#059669" }}
                  />
                </div>
              </div>
              <div className="w-24 shrink-0 text-right">
                <div className="text-sm font-semibold tabular">{money(r.net, { sign: true })}</div>
                <div className="text-xs text-gray-500">{r.count} txns</div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 px-3 md:bottom-4 md:left-1/2 md:right-auto md:w-[42rem] md:-translate-x-1/2">
          <div className="space-y-2 rounded-xl border bg-white p-3 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{selected.size} selected</span>
              <label className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                Applies to
                <select className="select text-xs" value={allTime ? "all" : "period"} onChange={(e) => setAllTime(e.target.value === "all")}>
                  <option value="period">this period</option>
                  <option value="all">all time</option>
                </select>
              </label>
              <button className="btn-ghost" onClick={() => setSelected(new Set())}>
                <X size={14} /> Clear
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input min-w-[10rem] flex-1"
                list="subcat-known"
                placeholder="Rename / merge into…"
                value={rename}
                onChange={(e) => setRename(e.target.value)}
              />
              <button
                className="btn-primary"
                disabled={busy || !renameTo}
                onClick={() => run(() => ({ sub_category: renameTo }), `Renamed to “${renameTo}”`)}
              >
                Rename
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="select min-w-[10rem] flex-1 text-sm" value={move} onChange={(e) => setMove(e.target.value)}>
                <option value="">Move to category…</option>
                {CATEGORIES.filter((c) => c.name !== category).map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                className="btn-primary"
                disabled={busy || !move}
                onClick={() =>
                  run(
                    (r) => ({ category: move, sub_category: r.key === NO_SUB_CATEGORY ? null : r.name }),
                    `Moved to ${move}`
                  )
                }
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
