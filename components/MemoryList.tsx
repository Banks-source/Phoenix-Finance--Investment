"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/taxonomy";
import { Trash2, RefreshCw } from "lucide-react";

export interface MemoryRule {
  id: string;
  merchant_pattern: string;
  category: string;
  sub_category: string | null;
  match_count: number;
  source: string | null;
  sample: string | null;
}

const SOURCE_LABEL: Record<string, { label: string; cls: string }> = {
  user: { label: "You set it", cls: "bg-indigo-50 text-indigo-700" },
  confirmed: { label: "You approved it", cls: "bg-emerald-50 text-emerald-700" },
  history: { label: "Inferred", cls: "bg-gray-100 text-gray-600" },
};

export default function MemoryList({ rules }: { rules: MemoryRule[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toUpperCase();
    return needle ? rules.filter((r) => r.merchant_pattern.includes(needle) || r.category.toUpperCase().includes(needle)) : rules;
  }, [rules, q]);

  async function call(method: string, url: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(`Failed: ${data.error ?? res.status}`);
      return null;
    }
    startTransition(() => router.refresh());
    return data;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input min-w-[12rem] flex-1" placeholder="Search payees or categories" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="btn-ghost"
          disabled={busy}
          onClick={async () => {
            const d = await call("POST", "/api/rules/rebuild");
            if (d) setMsg(`Tidied ${d.legacyRekeyed} old rules, dropped ${d.legacyDropped}, learned ${d.seeded} from your approved history.`);
          }}
        >
          <RefreshCw size={14} /> Rebuild from history
        </button>
      </div>
      {msg && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</div>}

      <div className="card divide-y divide-gray-100">
        {shown.length === 0 && <div className="p-4 text-sm text-gray-500">Nothing remembered yet — categorise something in Review and it will show up here.</div>}
        {shown.slice(0, 300).map((r) => (
          <Row key={r.id + r.category + r.sub_category} r={r} busy={busy} onSave={(category, sub) => call("PATCH", "/api/rules", { id: r.id, category, sub_category: sub }).then((d) => d && d.alsoUpdated && setMsg(`Saved · also updated ${d.alsoUpdated} unreviewed`))} onDelete={() => call("DELETE", "/api/rules", { id: r.id })} />
        ))}
      </div>
      {shown.length > 300 && <p className="text-xs text-gray-500">Showing 300 of {shown.length} — search to narrow.</p>}
    </div>
  );
}

function Row({ r, busy, onSave, onDelete }: { r: MemoryRule; busy: boolean; onSave: (c: string, s: string) => void; onDelete: () => void }) {
  const [cat, setCat] = useState(r.category);
  const [sub, setSub] = useState(r.sub_category ?? "");
  const dirty = cat !== r.category || sub.trim() !== (r.sub_category ?? "");
  const src = SOURCE_LABEL[r.source ?? "user"] ?? SOURCE_LABEL.user;
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
      <div className="min-w-[11rem] flex-1">
        <div className="text-sm font-medium">{r.merchant_pattern}</div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className={`rounded px-1.5 py-0.5 ${src.cls}`}>{src.label}</span>
          <span>{r.match_count}×</span>
          {r.sample && <span className="truncate">{r.sample}</span>}
        </div>
      </div>
      <select className="select text-sm" value={cat} onChange={(e) => setCat(e.target.value)}>
        {CATEGORIES.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
      <input className="input w-36 text-sm" placeholder="Sub-category" value={sub} onChange={(e) => setSub(e.target.value)} />
      <button className="btn-primary" disabled={busy || !dirty} onClick={() => onSave(cat, sub.trim())}>
        Save
      </button>
      <button className="btn-ghost !px-2" disabled={busy} onClick={onDelete} aria-label="Forget this payee" title="Forget this payee">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
