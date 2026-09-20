"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Txn, TxnFilter } from "@/lib/queries";
import { CATEGORIES } from "@/lib/taxonomy";
import { money } from "@/lib/format";
import { TypeBadge } from "@/components/ui";
import { Check, ChevronDown, ChevronRight, Undo2, X } from "lucide-react";

// One transaction list for the whole app: the same rows, the same inline edit
// and the same bulk-edit bar wherever you reach transactions from.

const OWNER_LABEL: Record<string, string> = { lloyd: "Lloyd", milani: "Milani", joint: "Joint" };

async function post(body: unknown): Promise<boolean> {
  const res = await fetch("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

type Prev = Pick<Txn, "id" | "category" | "sub_category" | "owner" | "status">;

export default function TxnList({
  rows,
  total,
  filter,
  allSubCategories = [],
  accountNames = {},
}: {
  rows: Txn[];
  /** How many transactions match the current filters (may exceed what's on this page). */
  total: number;
  /** The filters in force — lets "select all N" reach rows beyond this page. */
  filter: TxnFilter;
  allSubCategories?: string[];
  accountNames?: Record<string, string>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; undo?: Prev[]; error?: boolean } | null>(null);

  // bulk-edit form
  const [cat, setCat] = useState("");
  const [sub, setSub] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState<"" | "approved" | "pending_review">("");

  const knownSubs = useMemo(
    () =>
      [...new Set([...allSubCategories, ...rows.map((r) => r.sub_category).filter((s): s is string => !!s)])].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      ),
    [rows, allSubCategories]
  );

  const days = useMemo(() => {
    const m = new Map<string, Txn[]>();
    for (const r of rows) (m.get(r.date) ?? m.set(r.date, []).get(r.date)!).push(r);
    return [...m.entries()]; // rows arrive newest-first
  }, [rows]);

  const count = allMatching ? total : selected.size;
  const pageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setAllMatching(false);
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleMany(ids: string[], on: boolean) {
    setAllMatching(false);
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });
  }
  function clearSelection() {
    setSelected(new Set());
    setAllMatching(false);
    setShowEdit(false);
  }

  function done(text: string, undo?: Prev[]) {
    setBusy(false);
    setMessage({ text, undo });
    setCat("");
    setSub("");
    setOwner("");
    setStatus("");
    clearSelection();
    startTransition(() => router.refresh());
  }

  /** Apply a change to the selection (or every match), with an undo snapshot when we hold the rows. */
  async function apply(change: Record<string, unknown>, summary: string) {
    setBusy(true);
    const target = allMatching ? { filter } : { ids: [...selected] };
    const byId = new Map(rows.map((r) => [r.id, r]));
    const undo: Prev[] | undefined = allMatching
      ? undefined // can't snapshot rows we haven't loaded
      : [...selected].flatMap((id) => {
          const r = byId.get(id);
          return r ? [{ id, category: r.category, sub_category: r.sub_category, owner: r.owner, status: r.status }] : [];
        });
    const ok = await post({ ...target, keepStatus: true, ...change });
    if (!ok) {
      setBusy(false);
      setMessage({ text: "Couldn't save that — nothing was changed.", error: true });
      return;
    }
    done(`${summary} · ${count.toLocaleString()} transaction${count === 1 ? "" : "s"}`, undo);
  }

  async function applyForm() {
    const change: Record<string, unknown> = {};
    const parts: string[] = [];
    if (cat) {
      change.category = cat;
      change.sub_category = sub.trim() || null;
      parts.push(sub.trim() ? `${cat} › ${sub.trim()}` : cat);
    } else if (sub.trim()) {
      change.sub_category = sub.trim();
      parts.push(`sub-category ${sub.trim()}`);
    }
    if (owner) {
      change.owner = owner;
      parts.push(OWNER_LABEL[owner]);
    }
    if (status) {
      change.status = status;
      parts.push(status === "approved" ? "approved" : "sent to review");
    }
    if (!parts.length) return;
    await apply(change, `Set ${parts.join(", ")}`);
  }

  async function undo(prev: Prev[]) {
    setBusy(true);
    // Rows with identical previous values go back in one call each.
    const groups = new Map<string, Prev[]>();
    for (const p of prev) {
      const k = JSON.stringify([p.category, p.sub_category, p.owner, p.status]);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(p);
    }
    for (const g of groups.values()) {
      const p = g[0];
      await post({
        ids: g.map((x) => x.id),
        ...(p.category ? { category: p.category, sub_category: p.sub_category } : { sub_category: p.sub_category }),
        owner: p.owner,
        status: p.status,
        keepStatus: true,
      });
    }
    setBusy(false);
    setMessage({ text: "Undone" });
    startTransition(() => router.refresh());
  }

  // single-row inline edit
  async function saveRow(id: string, change: Record<string, unknown>) {
    setBusy(true);
    const ok = await post({ id, keepStatus: true, ...change });
    setBusy(false);
    if (!ok) return setMessage({ text: "Couldn't save that change.", error: true });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <datalist id="txnlist-subs">
        {knownSubs.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* select-all strip */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex min-h-[36px] items-center gap-2 text-gray-600">
          <input
            type="checkbox"
            checked={pageSelected}
            onChange={(e) => toggleMany(rows.map((r) => r.id), e.target.checked)}
          />
          Select this page ({rows.length})
        </label>
        {pageSelected && total > rows.length && !allMatching && (
          <button className="text-indigo-600 hover:underline" onClick={() => setAllMatching(true)}>
            Select all {total.toLocaleString()} matching these filters
          </button>
        )}
        {allMatching && (
          <span className="text-indigo-700">
            All {total.toLocaleString()} matching transactions selected ·{" "}
            <button className="underline" onClick={() => setAllMatching(false)}>
              just this page
            </button>
          </span>
        )}
      </div>

      {message && (
        <div
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
            message.error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          <span className="min-w-0 flex-1">{message.text}</span>
          {message.undo && message.undo.length > 0 && (
            <button className="inline-flex items-center gap-1 font-medium underline" onClick={() => undo(message.undo!)} disabled={busy}>
              <Undo2 size={14} /> Undo
            </button>
          )}
          <button aria-label="Dismiss" onClick={() => setMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* rows, grouped by day like a bank feed */}
      <div className="card overflow-hidden">
        {days.map(([date, items]) => (
          <section key={date}>
            <header className="flex items-center gap-3 border-b bg-gray-50 px-4 py-1.5">
              <input
                type="checkbox"
                aria-label={`Select ${dayLabel(date)}`}
                checked={items.every((t) => selected.has(t.id))}
                onChange={(e) => toggleMany(items.map((t) => t.id), e.target.checked)}
              />
              <span className="label-caps">{dayLabel(date)}</span>
              <span className="ml-auto text-xs tabular text-gray-500">
                {money(items.reduce((s, t) => s + Number(t.amount), 0), { decimals: true, sign: true })}
              </span>
            </header>
            <ul className="divide-y divide-gray-100">
              {items.map((t) => (
                <Row
                  key={`${t.id}|${t.category}|${t.sub_category}|${t.owner}|${t.status}`}
                  t={t}
                  account={t.account_id ? accountNames[t.account_id] : undefined}
                  checked={selected.has(t.id)}
                  isOpen={open === t.id}
                  busy={busy}
                  onToggle={() => toggle(t.id)}
                  onOpen={() => setOpen(open === t.id ? null : t.id)}
                  onSave={(change) => saveRow(t.id, change)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* bulk bar — above the tab bar on phones */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 px-3 md:bottom-4 md:left-1/2 md:right-auto md:w-[42rem] md:-translate-x-1/2">
          <div className="rounded-xl border bg-white p-3 shadow-lg">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{count.toLocaleString()} selected</span>
              <button className="btn-primary" onClick={() => setShowEdit((v) => !v)}>
                {showEdit ? "Close" : "Edit…"}
              </button>
              <button
                className="btn-ghost"
                disabled={busy}
                onClick={() => apply({ status: "approved" }, "Approved")}
                title="Mark as reviewed"
              >
                <Check size={14} /> Approve
              </button>
              <button className="btn-ghost ml-auto" onClick={clearSelection}>
                <X size={14} /> Clear
              </button>
            </div>
            {showEdit && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-xs text-gray-500">
                  Category
                  <select className="select mt-0.5 w-full text-sm" value={cat} onChange={(e) => setCat(e.target.value)}>
                    <option value="">Leave as is</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-gray-500">
                  Sub-category
                  <input
                    className="input mt-0.5 w-full"
                    list="txnlist-subs"
                    placeholder={cat ? "Optional — blank clears it" : "Leave as is"}
                    value={sub}
                    onChange={(e) => setSub(e.target.value)}
                  />
                </label>
                <label className="text-xs text-gray-500">
                  Owner
                  <select className="select mt-0.5 w-full text-sm" value={owner} onChange={(e) => setOwner(e.target.value)}>
                    <option value="">Leave as is</option>
                    {Object.entries(OWNER_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-gray-500">
                  Status
                  <select
                    className="select mt-0.5 w-full text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as typeof status)}
                  >
                    <option value="">Leave as is</option>
                    <option value="approved">Approved</option>
                    <option value="pending_review">Send back to review</option>
                  </select>
                </label>
                <button
                  className="btn-primary sm:col-span-2"
                  disabled={busy || !(cat || sub.trim() || owner || status)}
                  onClick={applyForm}
                >
                  {busy ? "Saving…" : `Apply to ${count.toLocaleString()}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  t,
  account,
  checked,
  isOpen,
  busy,
  onToggle,
  onOpen,
  onSave,
}: {
  t: Txn;
  account?: string;
  checked: boolean;
  isOpen: boolean;
  busy: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onSave: (change: Record<string, unknown>) => void;
}) {
  const [cat, setCat] = useState(t.category ?? "");
  const [sub, setSub] = useState(t.sub_category ?? "");
  const [owner, setOwner] = useState(t.owner);
  const dirty = cat !== (t.category ?? "") || sub.trim() !== (t.sub_category ?? "") || owner !== t.owner;
  const toReview = t.status === "pending_review";

  return (
    <li className={checked ? "bg-indigo-50/40" : ""}>
      <div className="flex items-start gap-3 px-4 py-2.5">
        <input
          type="checkbox"
          className="mt-1.5"
          aria-label="Select transaction"
          checked={checked}
          onChange={onToggle}
        />
        <button className="min-w-0 flex-1 text-left" onClick={onOpen} aria-expanded={isOpen}>
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.merchant || t.detail}</span>
            <span className={`shrink-0 text-sm font-medium tabular ${t.amount < 0 ? "" : "money-pos"}`}>
              {money(t.amount, { decimals: true, sign: true })}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            <span>{OWNER_LABEL[t.owner] ?? t.owner}</span>
            {account && <span className="truncate">· {account}</span>}
            <TypeBadge type={t.type} />
            <span className="text-gray-700">
              {t.category ?? "Uncategorised"}
              {t.sub_category && <span className="text-gray-400"> › {t.sub_category}</span>}
            </span>
            {toReview && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">to review</span>}
          </div>
        </button>
        <span className="mt-1 text-gray-300">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      </div>

      {isOpen && (
        <div className="space-y-3 border-t border-dashed bg-gray-50 px-4 py-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="text-xs text-gray-500">
              Category
              <select className="select mt-0.5 w-full text-sm" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Choose…</option>
                {CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Sub-category
              <input className="input mt-0.5 w-full" list="txnlist-subs" value={sub} onChange={(e) => setSub(e.target.value)} />
            </label>
            <label className="text-xs text-gray-500">
              Owner
              <select className="select mt-0.5 w-full text-sm" value={owner} onChange={(e) => setOwner(e.target.value)}>
                {Object.entries(OWNER_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-primary"
              disabled={busy || !cat || !dirty}
              onClick={() =>
                onSave({
                  ...(cat !== (t.category ?? "") ? { category: cat, sub_category: sub.trim() || null } : { sub_category: sub.trim() || null }),
                  ...(owner !== t.owner ? { owner } : {}),
                })
              }
            >
              Save
            </button>
            {toReview && (
              <button className="btn-ghost" disabled={busy} onClick={() => onSave({ status: "approved" })}>
                <Check size={14} /> Approve
              </button>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
            {(
              [
                ["Description", t.detail],
                ["Extended description", t.extended_description],
                ["Reference", t.reference],
                ["Bank category", t.provider_category],
                ["Posted", t.posted_at ? new Date(t.posted_at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }) : null],
                ["Why it's in review", t.review_reason],
                ["Source", t.source],
              ] as [string, string | null | undefined][]
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="label-caps">{k}</dt>
                  <dd className="break-words text-gray-800">{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}
    </li>
  );
}
