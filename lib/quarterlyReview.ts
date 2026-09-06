// Quarterly review workflow (#6) — docs/backlog-v2.5-data-layer.md: six
// steps, ≤30 min, steps 1-2 pre-computed, step 4 none-skippable, step 6
// writes a dated markdown log entry.
//
// Pure types, example constants, and the markdown generator only — no
// server-only imports, so this is safe for a "use client" component to
// import directly (see lib/quarterlyReviewServer.ts for the DB-touching
// orchestration functions).
//
// EXAMPLE CONTENT WARNING: the constants below (EXAMPLE_KILL_CRITERIA,
// EXAMPLE_CYCLE_INPUT_PROMPTS) are illustrative placeholders, not Lloyd's
// real thesis. He confirmed (2026-09-06) filling these with examples so the
// workflow is usable now — replace with the real text from
// phoenix-investment-thesis.md before treating a review as authoritative.

export const EXAMPLE_KILL_CRITERIA: string[] = [
  "Loss of confidence in Bitcoin's long-term monetary premise (e.g. a competing protocol/technology genuinely supersedes it)",
  "Regulatory ban or severe restriction on BTC/crypto ownership or custody in Australia",
  "Job loss or income disruption requiring liquidation of core thesis positions to cover living costs",
  "A health or family emergency requiring immediate liquidity beyond the dry-powder floor",
  "Sustained macro regime change that invalidates the thesis's core liquidity/debasement assumption",
  "Discovery of structural or custody risk in a sleeve vehicle (e.g. an ETF issuer failure or de-listing)",
  "A relationship or ownership-structure change requiring asset division that breaks the thesis's structure",
  "An advisor, legal, or creditor-driven requirement forcing liquidation regardless of the thesis",
];

export const EXAMPLE_CYCLE_INPUT_PROMPTS: string[] = [
  "BTC price vs 200-week moving average",
  "Global M2 liquidity trend (expanding / contracting)",
  "Crypto Fear & Greed Index reading",
  "Bitcoin dominance % (vs total crypto market cap)",
  "US 10-year real yield direction",
  "ISM manufacturing PMI (macro cycle indicator)",
];

export interface KillCriterionAnswer {
  text: string;
  status: "yes" | "no" | "not_assessed";
  note: string;
}

export interface QuarterlyReviewRecord {
  id: string;
  startedAt: string;
  completedAt: string | null;
  elapsedSeconds: number | null;
  cycleInputsNotes: string | null;
  killCriteria: KillCriterionAnswer[];
  actionsNotes: string | null;
  markdownLog: string | null;
  archived: boolean;
}

/** Generates the dated markdown changelog entry for a completed review (step 6). */
export function generateReviewMarkdown(
  review: Pick<QuarterlyReviewRecord, "startedAt" | "elapsedSeconds" | "cycleInputsNotes" | "killCriteria" | "actionsNotes">,
  hardRuleSummary: { rule: number; name: string; status: string }[]
): string {
  const date = review.startedAt.slice(0, 10);
  const lines: string[] = [`## Quarterly review — ${date}`, ""];
  lines.push(`Elapsed: ${review.elapsedSeconds != null ? `${Math.round(review.elapsedSeconds / 60)} min` : "—"}`, "");
  lines.push("### Hard rules");
  for (const r of hardRuleSummary) lines.push(`- Rule ${r.rule} (${r.name}): **${r.status}**`);
  lines.push("", "### Cycle inputs", review.cycleInputsNotes || "_(none recorded)_", "");
  lines.push("### Kill-criteria scan");
  for (const k of review.killCriteria) lines.push(`- [${k.status === "yes" ? "x" : " "}] ${k.text} — ${k.status}${k.note ? ` (${k.note})` : ""}`);
  lines.push("", "### Actions", review.actionsNotes || "_(none recorded)_", "");
  return lines.join("\n");
}
