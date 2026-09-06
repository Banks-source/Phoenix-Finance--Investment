"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AllocationSummary } from "@/lib/allocation";
import { SLEEVE_LABELS } from "@/lib/sleeves";
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
  const [mode, setMode] = useState<"sleeve" | "legacy" | null>(null);
  const [sleeve, setSleeve] = useState("");
  const [reason, setReason] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function assignSleeve() {
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

  async function flagLegacy() {
    if (!reason || !reviewDate) return;
    setBusy(true);
    await post("/api/legacy-positions", {
      kubera_portfolio_id: holding.portfolioId,
      asset_id: holding.assetId,
      asset_name: holding.name,
      reason,
      review_date: reviewDate,
    });
    setBusy(false);
    onSaved();
  }

  return (
    <div className="py-2 text-sm">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate">{holding.name}</span>
        <span className="text-xs text-gray-400">{holding.portfolioName}</span>
        <span className="tabular w-24 text-right">
          {holding.amount.toLocaleString()} {holding.currency}
        </span>
        {mode === null && (
          <>
            <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setMode("sleeve")}>
              Assign sleeve
            </button>
            <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setMode("legacy")}>
              Flag as legacy
            </button>
          </>
        )}
      </div>
      {mode === "sleeve" && (
        <div className="mt-1.5 flex items-center gap-2">
          <select className="select w-40 text-xs" value={sleeve} onChange={(e) => setSleeve(e.target.value)}>
            <option value="">Choose sleeve…</option>
            {Object.entries(SLEEVE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <button className="btn-primary !px-2.5 !py-1" onClick={assignSleeve} disabled={!sleeve || busy}>
            Save
          </button>
          <button className="btn-ghost !px-2 !py-1" onClick={() => setMode(null)}>
            Cancel
          </button>
        </div>
      )}
      {mode === "legacy" && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            className="input flex-1 text-xs"
            placeholder="Reason this breaches the thesis…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <input type="date" className="input !w-auto text-xs" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
          <button className="btn-primary !px-2.5 !py-1" onClick={flagLegacy} disabled={!reason || !reviewDate || busy}>
            Flag
          </button>
          <button className="btn-ghost !px-2 !py-1" onClick={() => setMode(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function LegacyPositionRow({
  position,
  onSaved,
}: {
  position: AllocationSummary["legacyPositions"][number];
  onSaved: () => void;
}) {
  const [decision, setDecision] = useState(position.decision ?? "");
  const [busy, setBusy] = useState(false);

  async function saveDecision(next: string) {
    setDecision(next);
    if (!next) return;
    setBusy(true);
    await post("/api/legacy-positions", {
      kubera_portfolio_id: position.portfolioId,
      asset_id: position.assetId,
      decision: next,
    });
    setBusy(false);
    onSaved();
  }

  return (
    <div className="py-2.5 text-sm">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate font-medium">{position.name}</span>
        <span className="text-xs text-gray-400">{position.portfolioName}</span>
        <span className="tabular w-28 text-right">{money(position.amountAud)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>{position.reason}</span>
        {position.breachedRule != null && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700">breaches rule {position.breachedRule}</span>}
        <span>Review by {position.reviewDate}</span>
        <select
          className="select ml-auto !py-0.5 text-xs"
          value={decision}
          onChange={(e) => saveDecision(e.target.value)}
          disabled={busy}
        >
          <option value="">Decision…</option>
          <option value="exit">Exit</option>
          <option value="hold">Hold</option>
          <option value="reclassify">Reclassify</option>
        </select>
      </div>
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
          <div className="text-sm font-semibold">Legacy (flagged)</div>
          <div className="mt-1 text-2xl font-semibold tabular">{money(summary.legacyAud)}</div>
          <p className="mt-1 text-xs text-gray-400">Confirmed breaches of the thesis, each with a reason and review date.</p>
        </div>
      </div>

      {summary.legacyPositions.length > 0 && (
        <div className="card p-5">
          <div className="mb-2 text-sm font-semibold">Legacy positions — need an exit/hold/reclassify decision</div>
          <div className="divide-y divide-gray-100">
            {summary.legacyPositions.map((p) => (
              <LegacyPositionRow key={`${p.portfolioId}-${p.assetId}`} position={p} onSaved={refresh} />
            ))}
          </div>
        </div>
      )}

      {summary.unmappedHoldings.length > 0 && (
        <div className="card p-5">
          <div className="mb-2 text-sm font-semibold">
            {summary.unmappedHoldings.length} holding{summary.unmappedHoldings.length === 1 ? "" : "s"} not yet classified
          </div>
          <div className="divide-y divide-gray-100">
            {summary.unmappedHoldings.map((h) => (
              <UnmappedRow key={`${h.portfolioId}-${h.assetId}`} holding={h} onSaved={refresh} />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Investable total (sleeves + property + legacy + unclassified, excludes debts): {money(summary.investableTotalAud)}.
        Nothing here executes a trade — signals only.
      </p>
    </div>
  );
}
