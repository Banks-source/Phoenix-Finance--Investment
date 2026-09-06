"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AllocationSummary } from "@/lib/allocation";
import { SLEEVE_LABELS, SleeveCode } from "@/lib/sleeves";
import { money } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

async function post(url: string, body: unknown) {
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function SleeveRow({ row, onSaved }: { row: AllocationSummary["sleeves"][number]; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [min, setMin] = useState(row.minPct != null ? String(row.minPct) : "");
  const [max, setMax] = useState(row.maxPct != null ? String(row.maxPct) : "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await post("/api/sleeve-targets", { sleeve: row.sleeve, min_pct: Number(min), max_pct: Number(max) });
    setBusy(false);
    setEditing(false);
    onSaved();
  }

  const barColor = row.breach === "over" ? "#e11d48" : row.breach === "under" ? "#f59e0b" : "#3b82f6";

  return (
    <div className="py-3">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          {SLEEVE_LABELS[row.sleeve]}
          {row.breach && <AlertTriangle size={13} className={row.breach === "over" ? "text-rose-600" : "text-amber-600"} />}
        </span>
        <span className="tabular text-gray-600">
          {money(row.totalAud)} · {row.pctOfInvestable.toFixed(1)}%
          {row.minPct != null && (
            <span className="ml-1.5 text-xs text-gray-400">
              (target {row.minPct}–{row.maxPct}%)
            </span>
          )}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.pctOfInvestable)}%`, backgroundColor: barColor }} />
      </div>
      <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
        <span>Personal {money(row.personalAud)}</span>
        <span>Retirement {money(row.retirementAud)}</span>
        {editing ? (
          <span className="ml-auto flex items-center gap-1">
            <input className="input !w-16 !py-0.5 text-xs" value={min} onChange={(e) => setMin(e.target.value)} placeholder="min %" />
            <span>–</span>
            <input className="input !w-16 !py-0.5 text-xs" value={max} onChange={(e) => setMax(e.target.value)} placeholder="max %" />
            <button className="btn-ghost !px-2 !py-0.5" onClick={save} disabled={busy}>
              Save
            </button>
          </span>
        ) : (
          <button className="ml-auto text-indigo-600 hover:underline" onClick={() => setEditing(true)}>
            {row.minPct != null ? "Edit target" : "Set target"}
          </button>
        )}
      </div>
    </div>
  );
}

function UnmappedRow({
  holding,
  onSaved,
}: {
  holding: AllocationSummary["unmappedHoldings"][number];
  onSaved: () => void;
}) {
  const [sleeve, setSleeve] = useState("");
  const [busy, setBusy] = useState(false);

  async function assign() {
    if (!sleeve) return;
    setBusy(true);
    await post("/api/sleeve-overrides", {
      kubera_portfolio_id: holding.portfolioId,
      asset_id: holding.assetId,
      asset_name: holding.name,
      sleeve,
    });
    setBusy(false);
    onSaved();
  }

  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">{holding.name}</span>
      <span className="text-xs text-gray-400">{holding.portfolioName}</span>
      <span className="tabular w-24 text-right">
        {holding.amount.toLocaleString()} {holding.currency}
      </span>
      <select className="select w-40 text-xs" value={sleeve} onChange={(e) => setSleeve(e.target.value)}>
        <option value="">Assign sleeve…</option>
        {Object.entries(SLEEVE_LABELS).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
      <button className="btn-primary !px-2.5 !py-1" onClick={assign} disabled={!sleeve || busy}>
        Save
      </button>
    </div>
  );
}

export default function AllocationDashboard({ summary }: { summary: AllocationSummary }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-6">
      <div className="card divide-y divide-gray-100 p-5">
        {summary.sleeves.map((row) => (
          <SleeveRow key={row.sleeve} row={row} onSaved={refresh} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <div className="text-sm font-semibold">Property</div>
          <div className="mt-1 text-2xl font-semibold tabular">{money(summary.propertyAud)}</div>
          <p className="mt-1 text-xs text-gray-400">Outside the thesis sleeves — tracked separately.</p>
        </div>
        <div className="card p-5">
          <div className="text-sm font-semibold">Legacy / unmapped</div>
          <div className="mt-1 text-2xl font-semibold tabular">{money(summary.legacyAud)}</div>
          <p className="mt-1 text-xs text-gray-400">Flagged (e.g. biofuels) or not yet reviewed — see below.</p>
        </div>
      </div>

      {summary.unmappedHoldings.length > 0 && (
        <div className="card p-5">
          <div className="mb-2 text-sm font-semibold">
            {summary.unmappedHoldings.length} holding{summary.unmappedHoldings.length === 1 ? "" : "s"} need a sleeve assigned
          </div>
          <div className="divide-y divide-gray-100">
            {summary.unmappedHoldings.map((h) => (
              <UnmappedRow key={`${h.portfolioId}-${h.assetId}`} holding={h} onSaved={refresh} />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Investable total (sleeves + property + legacy, excludes debts): {money(summary.investableTotalAud)}. Nothing
        here executes a trade — signals only.
      </p>
    </div>
  );
}
