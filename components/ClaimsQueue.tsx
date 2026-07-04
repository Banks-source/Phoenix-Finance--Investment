"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Txn } from "@/lib/queries";
import { money } from "@/lib/format";
import {
  deductibleBucketsBySchedule,
  SCHEDULE_LABELS,
  taxLabel,
  isDeductibleCode,
} from "@/lib/taxcats";
import { Check, ChevronDown, ChevronRight, Ban, Undo2, X } from "lucide-react";

async function post(body: unknown) {
  await fetch("/api/claims", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const BUCKETS = deductibleBucketsBySchedule();

const OWNERS: { key: string; label: string }[] = [
  { key: "lloyd", label: "Lloyd" },
  { key: "milani", label: "Milani" },
];

function OwnerToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-white p-0.5" title="Whose claim is this?">
      {OWNERS.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
            value === o.key ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TaxSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select className={className ?? "select w-52 text-xs"} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Tax category…</option>
      {BUCKETS.map((g) => (
        <optgroup key={g.schedule} label={SCHEDULE_LABELS[g.schedule]}>
          {g.items.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function ClaimsQueue({
  rows,
  priorByCategory,
  priorLabel,
}: {
  rows: Txn[];
  priorByCategory?: Record<string, number>;
  priorLabel?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [bulkCode, setBulkCode] = useState("");
  const [bulkOwner, setBulkOwner] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastTagged, setLastTagged] = useState<string[] | null>(null);
  const [, startTransition] = useTransition();

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

  function refresh() {
    setSelected(new Set());
    setBusy(false);
    startTransition(() => router.refresh());
  }

  async function applyBulk() {
    if (!selected.size || !bulkCode) return;
    setBusy(true);
    const ids = [...selected];
    await post({ ids, tax_category: bulkCode });
    setLastTagged(ids);
    setBulkCode("");
    refresh();
  }
  async function markNotDeductible() {
    if (!selected.size) return;
    setBusy(true);
    const ids = [...selected];
    await post({ ids, tax_category: "not_deductible", deductible: false });
    setLastTagged(ids);
    refresh();
  }
  async function tagRow(id: string, code: string) {
    setBusy(true);
    await post({ id, tax_category: code });
    setLastTagged([id]);
    refresh();
  }
  async function applyOwner() {
    if (!selected.size || !bulkOwner) return;
    setBusy(true);
    const ids = [...selected];
    await post({ ids, owner: bulkOwner });
    setLastTagged(ids);
    setBulkOwner("");
    refresh();
  }
  async function setRowOwner(id: string, owner: string) {
    setBusy(true);
    await post({ id, owner });
    refresh();
  }
  async function clearLast() {
    if (!lastTagged?.length) return;
    setBusy(true);
    await post({ ids: lastTagged, tax_category: null, deductible: null });
    setLastTagged(null);
    refresh();
  }

  const claimedCount = rows.filter((r) => r.deductible === true).length;

  return (
    <div className="space-y-4">
      {lastTagged && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-gray-700 bg-gray-900 py-2 pl-4 pr-2 text-sm text-white shadow-lg">
            <span>
              Tagged <span className="font-semibold">{lastTagged.length}</span>{" "}
              {lastTagged.length === 1 ? "transaction" : "transactions"}
            </span>
            <button
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-medium hover:bg-white/20 disabled:opacity-50"
              onClick={clearLast}
              disabled={busy}
            >
              <Undo2 size={14} /> Undo
            </button>
            <button className="rounded-full p-1 text-gray-400 hover:text-white" onClick={() => setLastTagged(null)} aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Sticky bulk bar */}
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-white/95 p-2.5 backdrop-blur">
        <label className="flex items-center gap-2 px-1 text-sm">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => toggleGroup(rows.map((r) => r.id), e.target.checked)}
          />
          <span className="font-medium">{selected.size || rows.length}</span>
          <span className="text-gray-500">{selected.size ? "selected" : "candidates"}</span>
        </label>
        <div className="mx-1 h-5 w-px bg-gray-200" />
        <TaxSelect value={bulkCode} onChange={setBulkCode} className="select text-sm" />
        <button className="btn-ghost" onClick={applyBulk} disabled={!selected.size || !bulkCode || busy}>
          <Check size={15} /> Apply to {selected.size || ""}
        </button>
        <button className="btn-ghost" onClick={markNotDeductible} disabled={!selected.size || busy}>
          <Ban size={15} /> Not deductible
        </button>
        <div className="mx-1 h-5 w-px bg-gray-200" />
        <select
          className="select text-sm"
          value={bulkOwner}
          onChange={(e) => setBulkOwner(e.target.value)}
          title="Assign these claims to a person"
        >
          <option value="">Owner…</option>
          {OWNERS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <button className="btn-ghost" onClick={applyOwner} disabled={!selected.size || !bulkOwner || busy}>
          <Check size={15} /> Assign owner
        </button>
        <span className="ml-auto text-xs text-gray-500">
          <span className="font-semibold text-emerald-600">{claimedCount}</span> marked deductible
        </span>
      </div>

      {groups.map(([cat, items]) => {
        const ids = items.map((r) => r.id);
        const groupSel = ids.filter((id) => selected.has(id)).length;
        const isCollapsed = collapsed.has(cat);
        const net = items.reduce((s, r) => s + Number(r.amount), 0);
        const prior = priorByCategory?.[cat];
        return (
          <div key={cat} className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b bg-gray-50 px-4 py-2.5">
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
              <span className="text-xs text-gray-500">{items.length} txns</span>
              {prior != null && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                  {priorLabel}: {money(prior, { sign: true })}
                </span>
              )}
              <span className="ml-auto tabular text-sm font-medium">{money(net, { sign: true })}</span>
            </div>

            {!isCollapsed && (
              <div className="divide-y divide-gray-100">
                {items.map((t) => {
                  const deductible = t.deductible === true;
                  const notDeductible = t.deductible === false;
                  return (
                    <div
                      key={t.id}
                      className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${
                        selected.has(t.id) ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                      <div className="w-20 shrink-0 text-xs text-gray-500 tabular">{t.date}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{t.merchant || t.detail}</div>
                        <div className="truncate text-xs text-gray-400">
                          {t.tax_category ? taxLabel(t.tax_category) : "Untagged"}
                        </div>
                      </div>
                      <OwnerToggle value={t.owner} onChange={(v) => setRowOwner(t.id, v)} />
                      <div className="w-24 shrink-0 text-right text-sm tabular font-medium">
                        {money(t.amount, { decimals: true, sign: true })}
                      </div>
                      <span
                        className={`hidden w-4 shrink-0 sm:block ${
                          deductible ? "text-emerald-600" : notDeductible ? "text-gray-300" : "text-gray-200"
                        }`}
                        title={deductible ? "Deductible" : notDeductible ? "Not deductible" : "Undecided"}
                      >
                        {notDeductible ? <Ban size={15} /> : <Check size={15} />}
                      </span>
                      <TaxSelect value={t.tax_category ?? ""} onChange={(v) => tagRow(t.id, v)} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
