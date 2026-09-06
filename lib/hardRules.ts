import { fetchClassifiedHoldings, fetchAllocationSummary, fetchTotalNetWorthAud, fetchBtcQuantityHistory } from "@/lib/allocation";
import { fetchAverageMonthlySpend } from "@/lib/queries";
import { convert } from "@/lib/fx";

const REPORTING_CURRENCY = "AUD";

// Hard rules (#7) — docs/backlog-v2.5-data-layer.md, "Encode the hard rules
// as automated checks". These exist because of the Tyquin St and Ocean Grove
// losses; their value is firing *before* a decision, not after. Every rule
// returns pass/fail/not_assessable plus a human-readable reason — never a
// silent guess when the data can't support a real answer.
//
// Rules are versioned: HARD_RULES_VERSION bumps whenever a rule's definition
// changes, so a past evaluation stays interpretable against the version that
// was in force when it ran (docs/backlog-v2.5-data-layer.md acceptance
// criteria for this issue).

export const HARD_RULES_VERSION = 1;

/** Static rule metadata (no evaluation) — for the /api/agent/v1/thesis endpoint. */
export const HARD_RULE_DEFINITIONS = [
  { rule: 1, name: "No co-invested illiquid deals" },
  { rule: 2, name: "Concentration: BTC ≤40% NW, other single assets ≤15%" },
  { rule: 3, name: "Leverage: PPR mortgage or ≤30% LVR income property only" },
  { rule: 4, name: "Liquidity floor: 3 months expenses + credit line" },
  { rule: 5, name: "Never sell BTC in a drawdown to fund spending" },
] as const;

export type RuleStatus = "pass" | "fail" | "not_assessable";

export interface RuleResult {
  rule: number;
  name: string;
  status: RuleStatus;
  reason: string;
  version: number;
}

function result(rule: number, name: string, status: RuleStatus, reason: string): RuleResult {
  return { rule, name, status, reason, version: HARD_RULES_VERSION };
}

// ---- Rule 1: no co-invested illiquid deals -------------------------------
// Check: any asset flagged illiquid AND co-owned → alert. Kubera's raw
// liquidity/ownership fields don't have confirmed semantics to auto-detect
// this reliably, so this rule checks the legacy_positions table (#8) instead
// — a human-confirmed record of known breaches (biofuels is the seeded
// example), not an automatic scan of unverified Kubera metadata.
export interface LegacyBreachInput {
  name: string;
  breachedRule: number | null;
  decision: "exit" | "hold" | "reclassify" | null;
}

export function evaluateRule1NoCoInvestedIlliquid(legacyPositions: LegacyBreachInput[]): RuleResult {
  const unresolved = legacyPositions.filter((p) => p.breachedRule === 1 && !p.decision);
  if (unresolved.length === 0) {
    return result(1, "No co-invested illiquid deals", "pass", "No unresolved rule-1 breaches in legacy_positions.");
  }
  return result(
    1,
    "No co-invested illiquid deals",
    "fail",
    `${unresolved.length} unresolved breach(es): ${unresolved.map((p) => p.name).join(", ")}`
  );
}

// ---- Rule 2: concentration ------------------------------------------------
// BTC ≤40% of TOTAL net worth (not investable net worth — the rule is
// written against the bigger denominator on purpose). Every other single
// asset ≤15% of investable net worth. "BTC" is matched by ticker OR name,
// since Kubera's wallet-aggregation entries sometimes report a wallet's
// value in AUD rather than the coin's own ticker (e.g. "Trezor - Bitcoin
// Wallet" can carry ticker=AUD) — a ticker-only check would miss those.
export interface ConcentrationAssetInput {
  name: string;
  ticker?: string;
  amountAud: number;
}

function isBtc(a: { name: string; ticker?: string }): boolean {
  return a.ticker?.toUpperCase() === "BTC" || /bitcoin/i.test(a.name);
}

export function evaluateRule2Concentration(
  assets: ConcentrationAssetInput[],
  totalNetWorthAud: number,
  investableTotalAud: number
): RuleResult {
  if (totalNetWorthAud <= 0 || investableTotalAud <= 0) {
    return result(2, "Concentration: BTC ≤40% NW, other single assets ≤15%", "not_assessable", "Net worth or investable total is zero or unavailable.");
  }
  const btcAud = assets.filter(isBtc).reduce((s, a) => s + a.amountAud, 0);
  const btcPct = (btcAud / totalNetWorthAud) * 100;
  const breaches: string[] = [];
  if (btcPct > 40) breaches.push(`BTC is ${btcPct.toFixed(1)}% of total net worth (limit 40%)`);
  for (const a of assets) {
    if (isBtc(a)) continue;
    const pct = (a.amountAud / investableTotalAud) * 100;
    if (pct > 15) breaches.push(`${a.name} is ${pct.toFixed(1)}% of investable net worth (limit 15%)`);
  }
  if (breaches.length === 0) return result(2, "Concentration: BTC ≤40% NW, other single assets ≤15%", "pass", "No concentration breach.");
  return result(2, "Concentration: BTC ≤40% NW, other single assets ≤15%", "fail", breaches.join("; "));
}

// ---- Rule 3: leverage ------------------------------------------------------
// PPR mortgage or ≤30% LVR income property only. No margin, no PG, no
// development finance. Any liability not matching one of those two allowed
// shapes alerts — that's the rule's literal wording, so an unrecognised debt
// (a personal loan, a credit card) fails rather than being skipped, and only
// genuinely zero-balance historical debts are excluded.
export interface DebtInput {
  name: string;
  amountAud: number;
}
export interface PropertyAssetInput {
  name: string;
  amountAud: number;
}

const LVR_LIMIT_PCT = 30;

function matchProperty(debtName: string, properties: PropertyAssetInput[]): PropertyAssetInput | undefined {
  const debtWords = debtName.toLowerCase();
  return properties.find((p) => {
    const key = p.name.toLowerCase().replace(/^\d+\s+/, ""); // "18 Ashby Crt" -> "ashby crt"
    return debtWords.includes(key) || key.includes(debtWords);
  });
}

export function evaluateRule3Leverage(debts: DebtInput[], properties: PropertyAssetInput[]): RuleResult {
  const active = debts.filter((d) => d.amountAud > 0);
  if (active.length === 0) {
    return result(3, "Leverage: PPR mortgage or ≤30% LVR income property only", "pass", "No active liabilities.");
  }
  const issues: string[] = [];
  for (const d of active) {
    const match = matchProperty(d.name, properties);
    if (match && match.amountAud > 0) {
      const lvr = (d.amountAud / match.amountAud) * 100;
      if (lvr > LVR_LIMIT_PCT) {
        issues.push(`${d.name}: LVR ${lvr.toFixed(1)}% against ${match.name} (limit ${LVR_LIMIT_PCT}% for income property)`);
      }
    } else {
      issues.push(`${d.name}: doesn't match an allowed liability type (PPR mortgage or ≤${LVR_LIMIT_PCT}% LVR income property)`);
    }
  }
  if (issues.length === 0) return result(3, "Leverage: PPR mortgage or ≤30% LVR income property only", "pass", "All active liabilities within the allowed shape.");
  return result(3, "Leverage: PPR mortgage or ≤30% LVR income property only", "fail", issues.join("; "));
}

// ---- Rule 4: liquidity floor -----------------------------------------------
// Cash+stables (the dry_powder sleeve total) vs 3× average monthly spend.
// Now computed from real bank-feed data (fetchAverageMonthlySpend) rather
// than the thesis's $250K/yr placeholder, now that Redbark/Kubera data exists.
export function evaluateRule4LiquidityFloor(dryPowderAud: number, averageMonthlySpendAud: number): RuleResult {
  if (averageMonthlySpendAud <= 0) {
    return result(4, "Liquidity floor: 3 months expenses + credit line", "not_assessable", "No spend data available to compute the floor.");
  }
  const floor = averageMonthlySpendAud * 3;
  if (dryPowderAud >= floor) {
    return result(
      4,
      "Liquidity floor: 3 months expenses + credit line",
      "pass",
      `Dry powder $${dryPowderAud.toFixed(0)} covers the $${floor.toFixed(0)} floor (3× $${averageMonthlySpendAud.toFixed(0)}/mo).`
    );
  }
  return result(
    4,
    "Liquidity floor: 3 months expenses + credit line",
    "fail",
    `Dry powder $${dryPowderAud.toFixed(0)} is short of the $${floor.toFixed(0)} floor (3× $${averageMonthlySpendAud.toFixed(0)}/mo) by $${(floor - dryPowderAud).toFixed(0)}.`
  );
}

// ---- Rule 5: never sell BTC in a drawdown to fund spending -----------------
// Tracks total BTC *quantity* (not value) across snapshots — quantity is
// insulated from price movement, so a real decrease reflects an actual sale,
// not just BTC's price falling. Needs at least 2 snapshots to say anything;
// with fewer, this is honestly not_assessable rather than a guess.
export interface BtcQuantityPoint {
  syncedAt: string;
  quantity: number;
}

export function evaluateRule5BtcSaleCheck(history: BtcQuantityPoint[]): RuleResult {
  if (history.length < 2) {
    return result(
      5,
      "Never sell BTC in a drawdown to fund spending",
      "not_assessable",
      `Only ${history.length} snapshot(s) with tracked BTC quantity so far — need at least 2 to detect a change.`
    );
  }
  const sorted = [...history].sort((a, b) => a.syncedAt.localeCompare(b.syncedAt));
  const prev = sorted[sorted.length - 2];
  const last = sorted[sorted.length - 1];
  if (last.quantity < prev.quantity) {
    return result(
      5,
      "Never sell BTC in a drawdown to fund spending",
      "fail",
      `BTC quantity dropped from ${prev.quantity} to ${last.quantity} between the last two syncs (${prev.syncedAt} → ${last.syncedAt}) — log a reason.`
    );
  }
  return result(5, "Never sell BTC in a drawdown to fund spending", "pass", "No BTC quantity decrease since the last sync.");
}

// ---- Orchestrator: fetch real data, evaluate all 5 ------------------------
export async function evaluateAllHardRules(): Promise<RuleResult[]> {
  const [holdings, summary, totalNetWorthAud, averageMonthlySpendAud, btcHistory] = await Promise.all([
    fetchClassifiedHoldings(),
    fetchAllocationSummary(),
    fetchTotalNetWorthAud(),
    fetchAverageMonthlySpend(3),
    fetchBtcQuantityHistory(),
  ]);

  const assets = holdings.filter((h) => !h.isDebt);
  const debts = holdings.filter((h) => h.isDebt);
  const assetsAud = await Promise.all(assets.map((a) => convert(a.amount, a.currency || REPORTING_CURRENCY, REPORTING_CURRENCY)));
  const debtsAud = await Promise.all(debts.map((d) => convert(d.amount, d.currency || REPORTING_CURRENCY, REPORTING_CURRENCY)));

  const concentrationAssets = assets.map((a, i) => ({ name: a.name, ticker: a.ticker, amountAud: assetsAud[i] }));
  const properties = assets
    .map((a, i) => ({ name: a.name, amountAud: assetsAud[i], sleeve: a.sleeve }))
    .filter((a) => a.sleeve === "property");
  const debtInputs = debts.map((d, i) => ({ name: d.name, amountAud: debtsAud[i] }));

  const dryPowderAud = summary.sleeves.find((s) => s.sleeve === "dry_powder");
  const dryPowderTotal = (dryPowderAud?.personalAud ?? 0) + (dryPowderAud?.retirementAud ?? 0);

  return [
    evaluateRule1NoCoInvestedIlliquid(
      summary.legacyPositions.map((p) => ({ name: p.name, breachedRule: p.breachedRule, decision: p.decision }))
    ),
    evaluateRule2Concentration(concentrationAssets, totalNetWorthAud, summary.investableTotalAud),
    evaluateRule3Leverage(debtInputs, properties),
    evaluateRule4LiquidityFloor(dryPowderTotal, averageMonthlySpendAud),
    evaluateRule5BtcSaleCheck(btcHistory),
  ];
}
