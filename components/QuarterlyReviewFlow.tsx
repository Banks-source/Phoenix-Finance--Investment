"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AllocationSummary } from "@/lib/allocation";
import { RuleResult } from "@/lib/hardRules";
import { KillCriterionAnswer, EXAMPLE_CYCLE_INPUT_PROMPTS } from "@/lib/quarterlyReview";
import { money } from "@/lib/format";
import { Clock, Copy } from "lucide-react";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

function useElapsed(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = Date.now() - seconds * 1000;
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return seconds;
}

function formatElapsed(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function QuarterlyReviewFlow() {
  const router = useRouter();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [allocation, setAllocation] = useState<AllocationSummary | null>(null);
  const [hardRules, setHardRules] = useState<RuleResult[]>([]);
  const [killCriteria, setKillCriteria] = useState<KillCriterionAnswer[]>([]);
  const [cycleInputsNotes, setCycleInputsNotes] = useState("");
  const [actionsNotes, setActionsNotes] = useState("");
  const [markdownLog, setMarkdownLog] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(false);
  const elapsed = useElapsed(reviewId !== null && markdownLog === null);

  async function start() {
    setBusy(true);
    const res = await post("/api/quarterly-review/start", {});
    setReviewId(res.reviewId);
    setAllocation(res.allocation);
    setHardRules(res.hardRules);
    setKillCriteria(res.killCriteria);
    setBusy(false);
    startedRef.current = true;
  }

  function updateKillCriterion(i: number, patch: Partial<KillCriterionAnswer>) {
    setKillCriteria((kc) => kc.map((k, idx) => (idx === i ? { ...k, ...patch } : k)));
  }

  async function goToStep(next: number) {
    if (!reviewId) return;
    setBusy(true);
    if (step === 3) await post("/api/quarterly-review/save", { reviewId, cycleInputsNotes });
    if (step === 4) await post("/api/quarterly-review/save", { reviewId, killCriteria });
    if (step === 5) await post("/api/quarterly-review/save", { reviewId, actionsNotes });
    setBusy(false);
    setStep(next);
  }

  async function complete() {
    if (!reviewId) return;
    setBusy(true);
    await post("/api/quarterly-review/save", { reviewId, actionsNotes });
    const res = await post("/api/quarterly-review/complete", { reviewId, elapsedSeconds: elapsed });
    setMarkdownLog(res.markdownLog);
    setBusy(false);
    router.refresh();
  }

  function copyLog() {
    if (markdownLog) navigator.clipboard.writeText(markdownLog);
  }

  if (!reviewId) {
    return (
      <div className="card p-5 text-center">
        <p className="mb-3 text-sm text-gray-500">A guided six-step review, timed — aim for under 30 minutes.</p>
        <button className="btn-primary" onClick={start} disabled={busy}>
          Start quarterly review
        </button>
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between border-b pb-3">
        <span className="text-sm font-semibold">Step {step} of 6</span>
        <span className={`flex items-center gap-1.5 text-sm tabular ${elapsed > 1800 ? "text-rose-600" : "text-gray-500"}`}>
          <Clock size={14} /> {formatElapsed(elapsed)}
          {elapsed > 1800 && " — over 30 min, log it"}
        </span>
      </div>

      {step === 1 && allocation && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">1. Update values</h3>
          <p className="mb-3 text-xs text-gray-500">Pre-computed from the latest sync — review, don&apos;t re-enter.</p>
          <div className="space-y-1 text-sm">
            {allocation.sleeves.map((s) => (
              <div key={s.sleeve} className="flex justify-between">
                <span>{s.sleeve}</span>
                <span className="tabular">{money(s.totalAud)}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary mt-3" onClick={() => goToStep(2)} disabled={busy}>
            Next
          </button>
        </div>
      )}

      {step === 2 && allocation && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">2. Band check</h3>
          <div className="space-y-2 text-sm">
            {allocation.sleeves.map((s) => (
              <div key={s.sleeve} className="flex items-center justify-between">
                <span>{s.sleeve}</span>
                <span className={s.breach ? "font-medium text-rose-600" : "text-gray-500"}>
                  {s.pctOfInvestable.toFixed(1)}%{s.breach ? ` — ${s.breach} band` : " — within band"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            {hardRules.map((r) => (
              <div key={r.rule} className="flex justify-between">
                <span>
                  Rule {r.rule}: {r.name}
                </span>
                <span className={r.status === "fail" ? "font-medium text-rose-600" : "text-gray-500"}>{r.status}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary mt-3" onClick={() => goToStep(3)} disabled={busy}>
            Next
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">3. Cycle inputs</h3>
          <p className="mb-2 text-xs text-gray-500">
            Prompts: {EXAMPLE_CYCLE_INPUT_PROMPTS.join(" · ")}
          </p>
          <textarea
            className="input h-32 w-full"
            value={cycleInputsNotes}
            onChange={(e) => setCycleInputsNotes(e.target.value)}
            placeholder="Record where each indicator sits this quarter…"
          />
          <button className="btn-primary mt-3" onClick={() => goToStep(4)} disabled={busy}>
            Next
          </button>
        </div>
      )}

      {step === 4 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">4. Kill-criteria scan</h3>
          <p className="mb-2 text-xs text-gray-500">Every criterion needs an explicit answer — none can be skipped.</p>
          <div className="space-y-3">
            {killCriteria.map((k, i) => (
              <div key={i} className="rounded-lg border p-2.5 text-sm">
                <div className="mb-1.5">{k.text}</div>
                <div className="flex items-center gap-2">
                  <select className="select !py-1 text-xs" value={k.status} onChange={(e) => updateKillCriterion(i, { status: e.target.value as KillCriterionAnswer["status"] })}>
                    <option value="not_assessed">Not assessed</option>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                  <input
                    className="input flex-1 !py-1 text-xs"
                    placeholder="Note (optional)"
                    value={k.note}
                    onChange={(e) => updateKillCriterion(i, { note: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary mt-3" onClick={() => goToStep(5)} disabled={busy}>
            Next
          </button>
        </div>
      )}

      {step === 5 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">5. Actions</h3>
          <textarea
            className="input h-32 w-full"
            value={actionsNotes}
            onChange={(e) => setActionsNotes(e.target.value)}
            placeholder="Any decisions or actions from this review…"
          />
          <button className="btn-primary mt-3" onClick={() => goToStep(6)} disabled={busy}>
            Next
          </button>
        </div>
      )}

      {step === 6 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">6. Log</h3>
          {markdownLog ? (
            <>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">{markdownLog}</pre>
              <button className="btn-ghost mt-2" onClick={copyLog}>
                <Copy size={14} /> Copy markdown
              </button>
            </>
          ) : (
            <>
              <p className="mb-3 text-xs text-gray-500">Generates a dated markdown entry and archives this review.</p>
              <button className="btn-primary" onClick={complete} disabled={busy}>
                Complete review
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
