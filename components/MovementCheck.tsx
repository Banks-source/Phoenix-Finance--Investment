"use client";
import { useState } from "react";
import { money } from "@/lib/format";
import type { MovementRunResult } from "@/lib/movementRun";

const KIND: Record<string, string> = {
  internal: "Between your own accounts",
  external: "To/from an account I don't recognise",
  loan_interest: "ING loan interest",
  loan_fee: "ING loan fees",
};

export default function MovementCheck({ defaultSince }: { defaultSince: string }) {
  const [since, setSince] = useState(defaultSince);
  const [res, setRes] = useState<MovementRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(apply: boolean) {
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/movement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apply, since }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(d.error ?? "Failed");
    setRes(d);
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="text-xs text-gray-500">
          From date
          <input type="date" className="input mt-0.5 block" value={since} onChange={(e) => setSince(e.target.value)} />
        </label>
        <button className="btn-ghost" disabled={busy} onClick={() => run(false)}>
          {busy ? "Working…" : "Preview changes"}
        </button>
        <button
          className="btn-primary"
          disabled={busy || !res || res.applied || res.changes === 0}
          onClick={() => run(true)}
          title={res ? "" : "Preview first"}
        >
          Apply {res && !res.applied ? res.changes : ""}
        </button>
      </div>
      {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}

      {res && (
        <div className="card space-y-3 p-4">
          <div className="text-sm">
            {res.applied ? "Applied" : "Would change"} <b>{res.changes}</b> of {res.scanned.toLocaleString()} transactions since {res.since}
            {res.sentToReview > 0 && <> · <b>{res.sentToReview}</b> sent to Review with a reason</>}
          </div>
          <ul className="text-sm text-gray-600">
            {Object.entries(res.byKind).map(([k, n]) => (
              <li key={k}>
                {n} × {KIND[k] ?? k}
              </li>
            ))}
          </ul>
          {res.samples.length > 0 && (
            <div className="divide-y divide-gray-100 rounded-lg border">
              {res.samples.map((s) => (
                <div key={s.id} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 text-xs">
                  <span className="w-20 text-gray-500">{s.date}</span>
                  <span className="min-w-0 flex-1 truncate">{s.detail}</span>
                  <span className="tabular">{money(s.amount, { decimals: true, sign: true })}</span>
                  <span className="w-full text-gray-500 sm:w-auto">
                    {s.from} → <span className="text-gray-800">{s.to}</span>
                    {s.toReview && <span className="ml-1 text-amber-600">⚑ review</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
          {res.changes > res.samples.length && <p className="text-xs text-gray-500">Showing the first {res.samples.length}.</p>}
        </div>
      )}
    </div>
  );
}
