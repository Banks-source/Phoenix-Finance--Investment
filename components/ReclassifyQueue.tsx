"use client";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Txn } from "@/lib/queries";
import { CATEGORIES } from "@/lib/taxonomy";
import { money } from "@/lib/format";
import { TypeBadge } from "@/components/ui";
import { ArrowLeft, ChevronDown, ChevronRight, Undo2, X } from "lucide-react";

type Prev = { id: string; category: string | null; sub_category: string | null };

async function post(body: unknown) {
  await fetch("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function ReclassifyQueue({
  rows,
  backHref,
}: {
  rows: Txn[];
  backHref: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState("");
  const [bulkSub, setBulkSub] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastChange, setLastChange] = useState<Prev[] | null>(null);
  const [sortBy, setSortBy] = useState<"merchant" | "date">("merchant");
  const [, startTransition] = useTransition();

  // Existing sub-categories in view, for the type-ahead datalist.
  const knownSubs = useMemo(
    () =>
      [...new Set(rows.map((r) => r.sub_category).filter((s): s is string => !!s))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      ),
    [rows]
  );

  // Group by current category, then sort each group by the chosen key.
  const groups = useMemo(() => {
    const m = new Map<string, Txn[]>();
    for (const r of rows) {
      const k = r.category ?? "Uncategorised";
      (m.get(k) ?? m.set(k, []).get(k)!).push(r);
    }
    for (const items of m.values()) {
      items.sort((a, b) =>
        sortBy === "date"
          ? (b.date || "").localeCompare(a.date || "") // newest first
          : (a.merchant || a.detail || "").localeCompare(b.merchant || b.detail || "", undefined, { sensitivity: "base" })
      );
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows, sortBy]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleGroup(ids: string[], on: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });
  }
  const allSelected = selected.size === rows.length && rows.length > 0;

  function refresh() {
    setSelected(new Set());
    setBusy(false);
    startTransition(() => router.refresh());
  }

  // Snapshot the current category of the rows we're about to change (for undo).
  function snapshot(ids: string[]): Prev[] {
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((r) => ({ id: r!.id, category: r!.category, sub_category: r!.sub_category }));
  }

  async function recategorise(ids: string[], category: string) {
    if (!ids.length || !category) return;
    setBusy(true);
    const prev = snapshot(ids);
    // keepStatus keeps these rows approved; the change is also learned as a rule.
    await post({ ids, category, keepStatus: true });
    setLastChange(prev);
    refresh();
  }
  // Set a sub-category on rows, keeping each row's existing category (so a mixed
  // selection stays in its categories). Grouped by category to relearn rules.
  async function setSubCategory(ids: string[], sub: string) {
    if (!ids.length) return;
    setBusy(true);
    const prev = snapshot(ids);
    const byCat = new Map<string | null, string[]>();
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const id of ids) {
      const cat = byId.get(id)?.category ?? null;
      (byCat.get(cat) ?? byCat.set(cat, []).get(cat)!).push(id);
    }
    for (const [cat, groupIds] of byCat) {
      await post(
        cat
          ? { ids: groupIds, category: cat, sub_category: sub || null, keepStatus: true }
          : { ids: groupIds, sub_category: sub || null, keepStatus: true }
      );
    }
    setLastChange(prev);
    refresh();
  }
  async function undoLastChange() {
    if (!lastChange?.length) return;
    setBusy(true);
    // Restore prior categories, grouping ids that shared the same old category.
    const groupsByCat = new Map<string, { category: string | null; sub_category: string | null; ids: string[] }>();
    for (const p of lastChange) {
      const key = `${p.category}|||${p.sub_category}`;
      const g = groupsByCat.get(key) ?? { category: p.category, sub_category: p.sub_category, ids: [] };
      g.ids.push(p.id);
      groupsByCat.set(key, g);
    }
    for (const g of groupsByCat.values()) {
      if (g.category) {
        await post({ ids: g.ids, category: g.category, sub_category: g.sub_category, keepStatus: true });
      } else {
        await post({ ids: g.ids, sub_category: g.sub_category, keepStatus: true });
      }
    }
    setLastChange(null);
    refresh();
  }

  return (
    <div className="space-y-4">
      <datalist id="known-subs">
        {knownSubs.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {/* Undo toast */}
      {lastChange && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-gray-700 bg-gray-900 py-2 pl-4 pr-2 text-sm text-white shadow-lg">
            <span>
              Reclassified <span className="font-semibold">{lastChange.length}</span>{" "}
              {lastChange.length === 1 ? "transaction" : "transactions"}
            </span>
            <button
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-medium hover:bg-white/20 disabled:opacity-50"
              onClick={undoLastChange}
              disabled={busy}
            >
              <Undo2 size={14} /> Undo
            </button>
            <button
              className="rounded-full p-1 text-gray-400 hover:text-white"
              onClick={() => setLastChange(null)}
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Sticky bulk action bar */}
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-white/95 p-2.5 backdrop-blur">
        <Link href={backHref} className="btn-ghost">
          <ArrowLeft size={15} /> Back
        </Link>

        <div className="mx-1 h-5 w-px bg-gray-200" />

        <label className="flex items-center gap-2 px-1 text-sm">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => toggleGroup(rows.map((r) => r.id), e.target.checked)}
          />
          <span className="font-medium">{selected.size || rows.length}</span>
          <span className="text-gray-500">{selected.size ? "selected" : "shown"}</span>
        </label>

        <div className="mx-1 h-5 w-px bg-gray-200" />

        <select
          className="select text-sm"
          value={bulkCat}
          onChange={(e) => setBulkCat(e.target.value)}
          disabled={!selected.size}
        >
          <option value="">Move to category…</option>
          {CATEGORIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          className="btn-primary"
          onClick={() => {
            recategorise([...selected], bulkCat);
            setBulkCat("");
          }}
          disabled={!selected.size || !bulkCat || busy}
        >
          Apply to {selected.size}
        </button>

        <div className="mx-1 h-5 w-px bg-gray-200" />

        <input
          className="input w-40 text-sm"
          list="known-subs"
          placeholder="Set sub-category…"
          value={bulkSub}
          onChange={(e) => setBulkSub(e.target.value)}
          disabled={!selected.size}
        />
        <button
          className="btn-primary"
          onClick={() => {
            setSubCategory([...selected], bulkSub.trim());
            setBulkSub("");
          }}
          disabled={!selected.size || !bulkSub.trim() || busy}
        >
          Set on {selected.size}
        </button>

        <div className="ml-auto flex items-center gap-1 text-xs">
          <span className="text-gray-500">Sort</span>
          <div className="flex overflow-hidden rounded-md border">
            <button
              className={`px-2.5 py-1 ${sortBy === "merchant" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              onClick={() => setSortBy("merchant")}
            >
              Name
            </button>
            <button
              className={`px-2.5 py-1 ${sortBy === "date" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              onClick={() => setSortBy("date")}
            >
              Date
            </button>
          </div>
        </div>
      </div>

      {/* Grouped rows */}
      {groups.map(([cat, items]) => {
        const ids = items.map((r) => r.id);
        const groupSel = ids.filter((id) => selected.has(id)).length;
        const isCollapsed = collapsed.has(cat);
        const net = items.reduce((s, r) => s + Number(r.amount), 0);
        return (
          <div key={cat} className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b bg-gray-50 px-4 py-2.5">
              <input
                type="checkbox"
                checked={groupSel === ids.length}
                ref={(el) => {
                  if (el) el.indeterminate = groupSel > 0 && groupSel < ids.length;
                }}
                onChange={(e) => toggleGroup(ids, e.target.checked)}
              />
              <button
                className="flex items-center gap-1.5 font-medium"
                onClick={() =>
                  setCollapsed((c) => {
                    const n = new Set(c);
                    n.has(cat) ? n.delete(cat) : n.add(cat);
                    return n;
                  })
                }
              >
                {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                {cat}
              </button>
              <TypeBadge type={items[0].type} />
              <span className="text-xs text-gray-500">{items.length} txns</span>
              <span className="ml-auto tabular text-sm font-medium">{money(net, { sign: true })}</span>
            </div>

            {!isCollapsed && (
              <div className="divide-y divide-gray-100">
                {items.map((t) => (
                  <div key={t.id} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${selected.has(t.id) ? "bg-indigo-50/40" : ""}`}>
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                    <div className="w-20 shrink-0 text-xs text-gray-500 tabular">{t.date}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.merchant || t.detail}</div>
                      <div className="truncate text-xs text-gray-400">
                        {t.owner}
                        {t.sub_category ? ` · ${t.sub_category}` : ""} · {t.detail}
                      </div>
                    </div>
                    <div className={`w-24 shrink-0 text-right text-sm tabular font-medium ${t.amount < 0 ? "" : "text-emerald-600"}`}>
                      {money(t.amount, { decimals: true, sign: true })}
                    </div>
                    <select
                      className="select w-40 text-xs"
                      value={t.category ?? ""}
                      onChange={(e) => recategorise([t.id], e.target.value)}
                    >
                      <option value="">Choose…</option>
                      {CATEGORIES.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <SubInput
                      key={t.sub_category ?? ""}
                      value={t.sub_category ?? ""}
                      onCommit={(v) => {
                        if (v !== (t.sub_category ?? "")) setSubCategory([t.id], v);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {rows.length === 0 && (
        <div className="card p-8 text-center text-sm text-gray-500">
          Nothing here. <Link href={backHref} className="text-indigo-600 hover:underline">Go back</Link>.
        </div>
      )}
    </div>
  );
}

// Per-row sub-category editor. Commits on Enter or blur (only when changed) so
// we don't fire a request on every keystroke.
function SubInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <input
      className="input w-36 text-xs"
      list="known-subs"
      placeholder="Sub-category…"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      onBlur={() => onCommit(v.trim())}
    />
  );
}
