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
  sleeve: SleeveCode | null; // null = genuinely unmapped — needs a sleeve_overrides row
  method: "crypto_rule" | "cash_rule" | "property_rule" | "override" | "unmapped";
  currency: string;
  amount: number;
  isDebt: boolean;
}

interface KuberaAssetRaw extends KuberaAssetLike {
  value?: { amount: number; currency: string };
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

export interface AllocationSummary {
  sleeves: SleeveAllocationRow[]; // the 6 thesis sleeves only
  propertyAud: number;
  legacyAud: number; // "legacy" override + anything still genuinely unmapped
  investableTotalAud: number; // sleeves + property + legacy — everything asset-side, no debts
  unmappedHoldings: ClassifiedHolding[]; // sleeve === null, excludes debts — needs a sleeve_overrides row
}

/**
 * Aggregates fetchClassifiedHoldings() into $ and % by sleeve, converted to
 * AUD (Kubera reports each holding in its own native currency), against
 * whatever target bands exist in sleeve_targets (empty by default — same
 * "no targets set" pattern as `budgets`). Percentages are of total
 * investable assets (sleeves + property + legacy combined), so an
 * over-allocation to property or an unreviewed legacy pile is visible as
 * "missing" from the 6 sleeves, not hidden by excluding it from the base.
 */
export async function fetchAllocationSummary(): Promise<AllocationSummary> {
  const supabase = createServiceClient();
  const [holdings, { data: targets }] = await Promise.all([
    fetchClassifiedHoldings(),
    supabase.from("sleeve_targets").select("sleeve, min_pct, max_pct"),
  ]);
  const targetBySleeve = new Map((targets ?? []).map((t) => [t.sleeve, { min: Number(t.min_pct), max: Number(t.max_pct) }]));

  const assets = holdings.filter((h) => !h.isDebt);
  const audAmounts = await Promise.all(assets.map((h) => convert(h.amount, h.currency || REPORTING_CURRENCY, REPORTING_CURRENCY)));

  const bySleeve = new Map<SleeveCode, { personal: number; retirement: number }>();
  let propertyAud = 0;
  let legacyAud = 0;
  const unmappedHoldings: ClassifiedHolding[] = [];

  assets.forEach((h, i) => {
    const aud = audAmounts[i];
    if (h.sleeve === "property") {
      propertyAud += aud;
    } else if (h.sleeve === "legacy" || h.sleeve === null) {
      legacyAud += aud;
      if (h.sleeve === null) unmappedHoldings.push(h);
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
  const investableTotalAud = THESIS_SLEEVES.reduce((sum, s) => sum + sleeveTotal(s), 0) + propertyAud + legacyAud;

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

  return { sleeves, propertyAud, legacyAud, investableTotalAud, unmappedHoldings };
}
