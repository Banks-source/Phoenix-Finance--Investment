"use client";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Txn } from "@/lib/queries";
import { CATEGORIES, resolveType } from "@/lib/taxonomy";
import { money } from "@/lib/format";
import { TypeBadge } from "@/components/ui";
import { Check, CheckCheck, ChevronDown, ChevronRight, Undo2, X } from "lucide-react";

async function post(body: unknown) {
  await fetch("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function ReviewQueue({ rows }: { rows: Txn[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastApproved, setLastApproved] = useState<string[] | null>(null);
  const [, startTransition] = useTransition();

  // Group by current category so similar items can be validated together,
  // then sort each group by merchant name so identical merchants sit adjacent.
  const groups = useMemo(() => {
    const m = new Map<string, Txn[]>();
    for (const r of rows) {
      const k = r.category ?? "Uncategorised";
      (m.get(k) ?? m.set(k, []).get(k)!).push(r);
    }
    for (const items of m.values()) {
      items.sort((a, b) =>
        (a.merchant || a.detail || "").localeCompare(b.merchant || b.detail || "", undefined, { sensitivity: "base" })
      );
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

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

  async function refresh() {
    setSelected(new Set());
    setBusy(false);
    startTransition(() => router.refresh());
  }

  async function approveSelected() {
    if (!selected.size) return;
    setBusy(true);
    const ids = [...selected];
    await post({ ids });
    setLastApproved(ids);
    refresh();
  }
  async function approveAll() {
    setBusy(true);
    const ids = rows.map((r) => r.id);
    await post({ ids });
    setLastApproved(ids);
    refresh();
  }
  async function recategoriseSelected() {
    if (!selected.size || !bulkCat) return;
    setBusy(true);
    // Keep status pending so you can still eyeball before approving.
    await post({ ids: [...selected], category: bulkCat, keepStatus: true });
    setBulkCat("");
    refresh();
  }
  async function approveRow(id: string, category?: string) {
    setBusy(true);
    await post({ id, category });
    setLastApproved([id]);
    refresh();
  }
  async function setRowCategory(id: string, category: string) {
    setBusy(true);
    await post({ id, category, keepStatus: true });
    refresh();
  }
  async function undoLastApproval() {
    if (!lastApproved?.length) return;
    setBusy(true);
    await post({ ids: lastApproved, status: "pending_review" });
    setLastApproved(null);
    refresh();
  }

  return (
    <div className="space-y-4">
      {/* Undo toast — appears after any approval so a misclick is one click away */}
      {lastApproved && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-gray-700 bg-gray-900 py-2 pl-4 pr-2 text-sm text-white shadow-lg">
            <span>
              Approved <span className="font-semibold">{lastApproved.length}</span>{" "}
              {lastApproved.length === 1 ? "transaction" : "transactions"}
            </span>
            <button
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-medium hover:bg-white/20 disabled:opacity-50"
              onClick={undoLastApproval}
              disabled={busy}
            >
              <Undo2 size={14} /> Undo
            </button>
            <button
              className="rounded-full p-1 text-gray-400 hover:text-white"
              onClick={() => setLastApproved(null)}
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Sticky bulk action bar */}
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-white/95 p-2.5 backdrop-blur">
        <label className="flex items-center gap-2 px-1 text-sm">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => toggleGroup(rows.map((r) => r.id), e.target.checked)}
          />
          <span className="font-medium">{selected.size || rows.length}</span>
          <span className="text-gray-500">{selected.size ? "selected" : "pending"}</span>
        </label>

        <div className="mx-1 h-5 w-px bg-gray-200" />

        <select
          className="select text-sm"
          value={bulkCat}
          onChange={(e) => setBulkCat(e.target.value)}
          disabled={!selected.size}
        >
          <option value="">Set category…</option>
          {CATEGORIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn-ghost" onClick={recategoriseSelected} disabled={!selected.size || !bulkCat || busy}>
          Apply to {selected.size}
        </button>

        <button className="btn-ghost" onClick={approveSelected} disabled={!selected.size || busy}>
          <Check size={15} /> Approve {selected.size || ""}
        </button>

        <div className="ml-auto">
          <button className="btn-primary" onClick={approveAll} disabled={busy}>
            <CheckCheck size={15} /> Approve all ({rows.length})
          </button>
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
                      <div className="truncate text-xs text-gray-400">{t.owner} · {t.detail}</div>
                    </div>
                    <div className={`w-24 shrink-0 text-right text-sm tabular font-medium ${t.amount < 0 ? "" : "text-emerald-600"}`}>
                      {money(t.amount, { decimals: true, sign: true })}
                    </div>
                    <select
                      className="select w-40 text-xs"
                      value={t.category ?? ""}
                      onChange={(e) => setRowCategory(t.id, e.target.value)}
                    >
                      <option value="">Choose…</option>
                      {CATEGORIES.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-primary !px-2.5"
                      onClick={() => approveRow(t.id)}
                      disabled={busy || !t.category}
                      title="Approve"
                    >
                      <Check size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
