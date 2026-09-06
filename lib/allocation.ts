import { createServiceClient } from "@/lib/supabase/server";
import { classifyHolding, SleeveCode, PortfolioGroupName, KuberaAssetLike, THESIS_SLEEVES } from "@/lib/sleeves";
import { convert } from "@/lib/fx";

const REPORTING_CURRENCY = "AUD";

export interface ClassifiedHolding {
  portfolioId: string;
  portfolioName: string;
  group: PortfolioGroupName | null; // null = portfolio has no portfolio_groups row yet
  assetId: string;
  name: string;
  ticker?: string;
  quantity?: number;
  sleeve: SleeveCode | null; // null = genuinely unmapped — needs a sleeve_overrides row
  method: "crypto_rule" | "cash_rule" | "property_rule" | "override" | "unmapped";
  currency: string;
  amount: number;
  isDebt: boolean;
}

interface KuberaAssetRaw extends KuberaAssetLike {
  value?: { amount: number; currency: string };
  ticker?: string;
  quantity?: number;
}

/**
 * Every asset + debt line item from the latest snapshot of each portfolio,
 * classified into a sleeve. Debts are included (isDebt: true) but never
 * classified into a sleeve — they reduce net worth, they don't belong to an
 * asset allocation. Nothing here is guessed past what lib/sleeves.ts's rules
 * can confidently say: an unmapped portfolio (no portfolio_groups row) or an
 * unmapped holding (no rule match and no sleeve_overrides row) comes back
 * with group/sleeve as null rather than a silent default.
 */
export async function fetchClassifiedHoldings(): Promise<ClassifiedHolding[]> {
  const supabase = createServiceClient();

  const [{ data: snapshots }, { data: groups }, { data: overrides }] = await Promise.all([
    supabase
      .from("portfolio_snapshots")
      .select("kubera_portfolio_id, portfolio_name, synced_at, assets, debts")
      .order("synced_at", { ascending: false }),
    supabase.from("portfolio_groups").select("kubera_portfolio_id, group_name"),
    supabase.from("sleeve_overrides").select("kubera_portfolio_id, asset_id, sleeve"),
  ]);

  const groupByPortfolio = new Map((groups ?? []).map((g) => [g.kubera_portfolio_id, g.group_name as PortfolioGroupName]));
  const overrideByKey = new Map(
    (overrides ?? []).map((o) => [`${o.kubera_portfolio_id}|${o.asset_id}`, o.sleeve as SleeveCode])
  );

  // Latest snapshot per portfolio only (snapshots are append-only history).
  const latestByPortfolio = new Map<string, NonNullable<typeof snapshots>[number]>();
  for (const s of snapshots ?? []) {
    if (!latestByPortfolio.has(s.kubera_portfolio_id)) latestByPortfolio.set(s.kubera_portfolio_id, s);
  }

  const out: ClassifiedHolding[] = [];
  for (const snap of latestByPortfolio.values()) {
    const group = groupByPortfolio.get(snap.kubera_portfolio_id) ?? null;

    for (const a of (snap.assets as KuberaAssetRaw[]) ?? []) {
      const overrideKey = `${snap.kubera_portfolio_id}|${a.id}`;
      const override = overrideByKey.get(overrideKey);
      const classified = override ? { sleeve: override, method: "override" as const } : classifyHolding(a);
      out.push({
        portfolioId: snap.kubera_portfolio_id,
        portfolioName: snap.portfolio_name,
        group,
        assetId: a.id,
        name: a.name,
        ticker: a.ticker,
        quantity: a.quantity,
        sleeve: classified.sleeve,
        method: classified.method,
        currency: a.value?.currency ?? "",
        amount: a.value?.amount ?? 0,
        isDebt: false,
      });
    }

    for (const d of (snap.debts as KuberaAssetRaw[]) ?? []) {
      out.push({
        portfolioId: snap.kubera_portfolio_id,
        portfolioName: snap.portfolio_name,
        group,
        assetId: d.id,
        name: d.name,
        sleeve: null,
        method: "unmapped",
        currency: d.value?.currency ?? "",
        amount: d.value?.amount ?? 0,
        isDebt: true,
      });
    }
  }

  return out;
}

export interface SleeveAllocationRow {
  sleeve: SleeveCode;
  personalAud: number;
  retirementAud: number;
  totalAud: number;
  pctOfInvestable: number;
  minPct: number | null;
  maxPct: number | null;
  breach: "under" | "over" | null;
}

export interface LegacyPositionRow extends ClassifiedHolding {
  amountAud: number;
  reason: string;
  breachedRule: number | null;
  reviewDate: string;
  decision: "exit" | "hold" | "reclassify" | null;
}

export interface GroupTotal {
  grossAud: number; // every asset (sleeves + property + legacy + unmapped)
  debtsAud: number;
  netAud: number;
}

export interface AllocationSummary {
  sleeves: SleeveAllocationRow[]; // the 6 thesis sleeves only
  propertyAud: number;
  legacyAud: number; // sum of confirmed legacy_positions rows (#8) — not the same as "unmapped"
  investableTotalAud: number; // sleeves + property + legacy — everything asset-side, no debts
  unmappedHoldings: ClassifiedHolding[]; // sleeve === null AND no legacy_positions row — genuinely pending a decision
  legacyPositions: LegacyPositionRow[]; // holdings explicitly flagged as breaching the thesis, with reason/decision
  groupTotals: { personal: GroupTotal; retirement: GroupTotal; ungrouped: GroupTotal };
}

/**
 * Aggregates fetchClassifiedHoldings() into $ and % by sleeve, converted to
 * AUD (Kubera reports each holding in its own native currency), against
 * whatever target bands exist in sleeve_targets (seeded from the thesis
 * doc's bands, but editable if the thesis changes). Percentages are of
 * total investable assets (sleeves + property + legacy combined), so an
 * over-allocation to property or an unreviewed legacy pile is visible as
 * "missing" from the 6 sleeves, not hidden by excluding it from the base.
 *
 * A holding counts as "legacy" only if it has an explicit legacy_positions
 * row (#8) — a required reason + review date, never inferred. A holding
 * with no sleeve and no legacy row is "unmapped": still pending either a
 * sleeve assignment or a legacy decision, shown separately so the two
 * don't get conflated.
 */
export async function fetchAllocationSummary(): Promise<AllocationSummary> {
  const supabase = createServiceClient();
  const [holdings, { data: targets }, { data: legacyRows }] = await Promise.all([
    fetchClassifiedHoldings(),
    supabase.from("sleeve_targets").select("sleeve, min_pct, max_pct"),
    supabase.from("legacy_positions").select("kubera_portfolio_id, asset_id, reason, breached_rule, review_date, decision"),
  ]);
  const targetBySleeve = new Map((targets ?? []).map((t) => [t.sleeve, { min: Number(t.min_pct), max: Number(t.max_pct) }]));
  const legacyByKey = new Map((legacyRows ?? []).map((l) => [`${l.kubera_portfolio_id}|${l.asset_id}`, l]));

  const assets = holdings.filter((h) => !h.isDebt);
  const debts = holdings.filter((h) => h.isDebt);
  const [audAmounts, debtAudAmounts] = await Promise.all([
    Promise.all(assets.map((h) => convert(h.amount, h.currency || REPORTING_CURRENCY, REPORTING_CURRENCY))),
    Promise.all(debts.map((h) => convert(h.amount, h.currency || REPORTING_CURRENCY, REPORTING_CURRENCY))),
  ]);

  const groupKey = (g: PortfolioGroupName | null): "personal" | "retirement" | "ungrouped" =>
    g === "retirement" ? "retirement" : g === "personal" ? "personal" : "ungrouped";
  const groupTotals = {
    personal: { grossAud: 0, debtsAud: 0, netAud: 0 },
    retirement: { grossAud: 0, debtsAud: 0, netAud: 0 },
    ungrouped: { grossAud: 0, debtsAud: 0, netAud: 0 },
  };
  assets.forEach((h, i) => (groupTotals[groupKey(h.group)].grossAud += audAmounts[i]));
  debts.forEach((h, i) => (groupTotals[groupKey(h.group)].debtsAud += debtAudAmounts[i]));
  for (const key of ["personal", "retirement", "ungrouped"] as const) {
    groupTotals[key].netAud = groupTotals[key].grossAud - groupTotals[key].debtsAud;
  }

  const bySleeve = new Map<SleeveCode, { personal: number; retirement: number }>();
  let propertyAud = 0;
  let legacyAud = 0;
  let unmappedTotalAud = 0;
  const unmappedHoldings: ClassifiedHolding[] = [];
  const legacyPositions: LegacyPositionRow[] = [];

  assets.forEach((h, i) => {
    const aud = audAmounts[i];
    const legacy = legacyByKey.get(`${h.portfolioId}|${h.assetId}`);
    if (legacy) {
      legacyAud += aud;
      legacyPositions.push({
        ...h,
        amountAud: aud,
        reason: legacy.reason,
        breachedRule: legacy.breached_rule,
        reviewDate: legacy.review_date,
        decision: legacy.decision,
      });
    } else if (h.sleeve === "property") {
      propertyAud += aud;
    } else if (h.sleeve === null) {
      // Real, held asset, just not classified yet — still counts toward the
      // investable base (never silently dropped, per the docs), it's just
      // not attributed to any of the 6 sleeves until reviewed.
      unmappedTotalAud += aud;
      unmappedHoldings.push(h);
    } else {
      const bucket = bySleeve.get(h.sleeve) ?? { personal: 0, retirement: 0 };
      if (h.group === "retirement") bucket.retirement += aud;
      else bucket.personal += aud; // personal, or ungrouped — surfaced elsewhere, still counted
      bySleeve.set(h.sleeve, bucket);
    }
  });

  const sleeveTotal = (s: SleeveCode) => {
    const b = bySleeve.get(s) ?? { personal: 0, retirement: 0 };
    return b.personal + b.retirement;
  };
  const investableTotalAud =
    THESIS_SLEEVES.reduce((sum, s) => sum + sleeveTotal(s), 0) + propertyAud + legacyAud + unmappedTotalAud;

  const sleeves: SleeveAllocationRow[] = THESIS_SLEEVES.map((sleeve) => {
    const b = bySleeve.get(sleeve) ?? { personal: 0, retirement: 0 };
    const totalAud = b.personal + b.retirement;
    const pctOfInvestable = investableTotalAud > 0 ? (totalAud / investableTotalAud) * 100 : 0;
    const target = targetBySleeve.get(sleeve) ?? null;
    let breach: "under" | "over" | null = null;
    if (target) {
      if (pctOfInvestable < target.min) breach = "under";
      else if (pctOfInvestable > target.max) breach = "over";
    }
    return {
      sleeve,
      personalAud: b.personal,
      retirementAud: b.retirement,
      totalAud,
      pctOfInvestable,
      minPct: target?.min ?? null,
      maxPct: target?.max ?? null,
      breach,
    };
  });

  return { sleeves, propertyAud, legacyAud, investableTotalAud, unmappedHoldings, legacyPositions, groupTotals };
}

/** Total net worth across every portfolio's latest snapshot, converted to AUD. */
export async function fetchTotalNetWorthAud(): Promise<number> {
  const supabase = createServiceClient();
  const { data: snapshots } = await supabase
    .from("portfolio_snapshots")
    .select("kubera_portfolio_id, net_worth, currency, synced_at")
    .order("synced_at", { ascending: false });

  const latestByPortfolio = new Map<string, { net_worth: number; currency: string }>();
  for (const s of snapshots ?? []) {
    if (!latestByPortfolio.has(s.kubera_portfolio_id)) {
      latestByPortfolio.set(s.kubera_portfolio_id, { net_worth: s.net_worth, currency: s.currency });
    }
  }

  const amounts = await Promise.all(
    [...latestByPortfolio.values()].map((p) => convert(p.net_worth, p.currency || REPORTING_CURRENCY, REPORTING_CURRENCY))
  );
  return amounts.reduce((sum, a) => sum + a, 0);
}

const BTC_TICKER_OR_NAME = /bitcoin/i;

/** Total BTC quantity per snapshot sync (summed across every portfolio), for rule 5. */
export async function fetchBtcQuantityHistory(): Promise<{ syncedAt: string; quantity: number }[]> {
  const supabase = createServiceClient();
  const { data: snapshots } = await supabase.from("portfolio_snapshots").select("synced_at, assets");

  const byTimestamp = new Map<string, number>();
  for (const s of snapshots ?? []) {
    let total = byTimestamp.get(s.synced_at) ?? 0;
    for (const a of (s.assets as { name: string; ticker?: string; quantity?: number }[]) ?? []) {
      const isBtcAsset = a.ticker?.toUpperCase() === "BTC" || BTC_TICKER_OR_NAME.test(a.name);
      if (isBtcAsset && typeof a.quantity === "number") total += a.quantity;
    }
    byTimestamp.set(s.synced_at, total);
  }

  return [...byTimestamp.entries()].map(([syncedAt, quantity]) => ({ syncedAt, quantity }));
}

/** Net-worth time series (summed across every portfolio per sync, converted to AUD), optionally bounded by date. */
export async function fetchNetWorthHistory(from?: string, to?: string): Promise<{ syncedAt: string; netWorthAud: number }[]> {
  const supabase = createServiceClient();
  let q = supabase.from("portfolio_snapshots").select("synced_at, net_worth, currency").order("synced_at", { ascending: true });
  if (from) q = q.gte("synced_at", from);
  if (to) q = q.lte("synced_at", to);
  const { data } = await q;

  const byTimestamp = new Map<string, { net_worth: number; currency: string }[]>();
  for (const s of data ?? []) {
    const list = byTimestamp.get(s.synced_at) ?? [];
    list.push({ net_worth: s.net_worth, currency: s.currency });
    byTimestamp.set(s.synced_at, list);
  }

  const out: { syncedAt: string; netWorthAud: number }[] = [];
  for (const [syncedAt, rows] of byTimestamp) {
    const amounts = await Promise.all(rows.map((r) => convert(r.net_worth, r.currency || REPORTING_CURRENCY, REPORTING_CURRENCY)));
    out.push({ syncedAt, netWorthAud: amounts.reduce((s, a) => s + a, 0) });
  }
  return out.sort((a, b) => a.syncedAt.localeCompare(b.syncedAt));
}
