"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ThesisData } from "@/lib/thesisServer";
import { Trash2, Plus } from "lucide-react";

async function post(url: string, body: unknown) {
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

const PARAM_META: { key: keyof ThesisData["hardRuleParams"]; label: string }[] = [
  { key: "btc_pct_of_nw_max", label: "BTC max % of total net worth" },
  { key: "single_asset_pct_max", label: "Other single-asset max % of investable" },
  { key: "lvr_pct_max", label: "Max LVR on an income property" },
  { key: "liquidity_months", label: "Months of expenses the liquidity floor covers" },
];

function NotesEditor({ initialNotes }: { initialNotes: string | null }) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    await post("/api/thesis-notes", { notes });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="card p-5">
      <h2 className="mb-2 text-sm font-semibold">Thesis notes</h2>
      <textarea
        className="input h-40 w-full"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Your core beliefs and reasoning — the narrative behind the sleeves and rules…"
      />
      <button className="btn-primary mt-2" onClick={save} disabled={busy}>
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}

function SleeveBandEditor({ sleeve, onSaved }: { sleeve: ThesisData["sleeves"][number]; onSaved: () => void }) {
  const [min, setMin] = useState(sleeve.minPct != null ? String(sleeve.minPct) : "");
  const [max, setMax] = useState(sleeve.maxPct != null ? String(sleeve.maxPct) : "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await post("/api/sleeve-targets", { sleeve: sleeve.sleeve, min_pct: Number(min), max_pct: Number(max) });
    setBusy(false);
    onSaved();
  }

  return (
    <div className="flex items-center gap-2 py-2 text-sm">
      <span className="w-48 shrink-0">{sleeve.label}</span>
      <input className="input !w-20 !py-1 text-xs" value={min} onChange={(e) => setMin(e.target.value)} placeholder="min %" />
      <span className="text-gray-400">–</span>
      <input className="input !w-20 !py-1 text-xs" value={max} onChange={(e) => setMax(e.target.value)} placeholder="max %" />
      <button className="btn-ghost !px-2 !py-1" onClick={save} disabled={busy}>
        Save
      </button>
    </div>
  );
}

function ParamEditor({
  paramKey,
  label,
  value,
  onSaved,
}: {
  paramKey: string;
  label: string;
  value: number;
  onSaved: () => void;
}) {
  const [v, setV] = useState(String(value));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await post("/api/hard-rule-params", { param_key: paramKey, value: Number(v) });
    setBusy(false);
    onSaved();
  }

  return (
    <div className="flex items-center gap-2 py-2 text-sm">
      <span className="flex-1">{label}</span>
      <input className="input !w-20 !py-1 text-xs" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn-ghost !px-2 !py-1" onClick={save} disabled={busy}>
        Save
      </button>
    </div>
  );
}

function KillCriterionEditor({
  criterion,
  onSaved,
}: {
  criterion: ThesisData["killCriteriaTemplates"][number];
  onSaved: () => void;
}) {
  const [text, setText] = useState(criterion.text);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await post("/api/kill-criteria-templates", { id: criterion.id, text });
    setBusy(false);
    onSaved();
  }
  async function remove() {
    setBusy(true);
    await post("/api/kill-criteria-templates", { id: criterion.id, delete: true });
    setBusy(false);
    onSaved();
  }

  return (
    <div className="flex items-center gap-2 py-2 text-sm">
      <input className="input flex-1 text-xs" value={text} onChange={(e) => setText(e.target.value)} />
      {criterion.isExample && <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">example</span>}
      <button className="btn-ghost !px-2 !py-1" onClick={save} disabled={busy}>
        Save
      </button>
      <button className="btn-ghost !px-2 !py-1 text-rose-600" onClick={remove} disabled={busy}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function AddKillCriterion({ nextSortOrder, onSaved }: { nextSortOrder: number; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!text) return;
    setBusy(true);
    await post("/api/kill-criteria-templates", { text, sort_order: nextSortOrder });
    setText("");
    setBusy(false);
    onSaved();
  }

  return (
    <div className="flex items-center gap-2 py-2 text-sm">
      <input className="input flex-1 text-xs" placeholder="Add a new kill criterion…" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn-ghost !px-2 !py-1" onClick={add} disabled={!text || busy}>
        <Plus size={14} /> Add
      </button>
    </div>
  );
}

export default function ThesisEditor({ data }: { data: ThesisData }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-6">
      <NotesEditor initialNotes={data.notes} />

      <div className="card p-5">
        <h2 className="mb-2 text-sm font-semibold">Sleeve bands</h2>
        <div className="divide-y divide-gray-100">
          {data.sleeves.map((s) => (
            <SleeveBandEditor key={s.sleeve} sleeve={s} onSaved={refresh} />
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-2 text-sm font-semibold">Hard rule thresholds</h2>
        <div className="divide-y divide-gray-100">
          {PARAM_META.map((p) => (
            <ParamEditor key={p.key} paramKey={p.key} label={p.label} value={data.hardRuleParams[p.key]} onSaved={refresh} />
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Kill criteria</h2>
        <p className="mb-2 text-xs text-gray-500">
          Editing here never rewrites past quarterly reviews — those keep the wording as it was when the review ran.
        </p>
        <div className="divide-y divide-gray-100">
          {data.killCriteriaTemplates.map((k) => (
            <KillCriterionEditor key={k.id} criterion={k} onSaved={refresh} />
          ))}
          <AddKillCriterion nextSortOrder={data.killCriteriaTemplates.length} onSaved={refresh} />
        </div>
      </div>
    </div>
  );
}
