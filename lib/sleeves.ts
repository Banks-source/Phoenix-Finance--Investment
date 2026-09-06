// Investment-thesis sleeve mapping (#4) — docs/backlog-v2.5-data-layer.md
// (source: phoenix-investment-thesis.md). Six thesis sleeves with their real
// bands, plus "property" which sits outside the thesis (investment real
// estate doesn't fit any sleeve, tracked as its own bucket per Lloyd's
// call). A holding not confidently classified as a sleeve or property is
// left null (genuinely unmapped) — see lib/allocation.ts for how that
// interacts with the separate legacy_positions table (#8), which is a
// distinct concept from "unmapped": a legacy position may well have a
// sleeve assigned for reporting, it's flagged because it breaches the
// thesis, not because it's unclassified.

export type SleeveCode = "btc_crypto" | "ai_tech_materials" | "em_equity" | "health_biotech" | "dry_powder" | "metals" | "property";

export const SLEEVE_LABELS: Record<SleeveCode, string> = {
  btc_crypto: "BTC / Crypto",
  ai_tech_materials: "AI/Tech + Materials",
  em_equity: "EM Equity",
  health_biotech: "Health/Biotech",
  dry_powder: "Dry Powder",
  metals: "Metals",
  property: "Property",
};

/** The 6 real thesis sleeves — excludes property, which sits outside the thesis. */
export const THESIS_SLEEVES: SleeveCode[] = [
  "btc_crypto",
  "ai_tech_materials",
  "em_equity",
  "health_biotech",
  "dry_powder",
  "metals",
];

/** Bands from the thesis doc — seeded into sleeve_targets, not hardcoded as the
 * only source, so they stay editable in the dashboard if the thesis changes. */
export const THESIS_DEFAULT_BANDS: Record<SleeveCode, { min: number; max: number; note?: string }> = {
  btc_crypto: { min: 30, max: 40 },
  ai_tech_materials: { min: 20, max: 30 },
  em_equity: { min: 10, max: 20 },
  health_biotech: { min: 5, max: 10 },
  dry_powder: { min: 5, max: 15 },
  metals: { min: 0, max: 0, note: "trigger-gated — 0% until the thesis's entry trigger fires" },
  property: { min: 0, max: 100 }, // not a real thesis band; property isn't part of the thesis
};

export type PortfolioGroupName = "personal" | "retirement";

export interface KuberaAssetLike {
  id: string;
  name: string;
  assetClass?: string;
  category?: string;
  subType?: string;
}

export interface ClassifyResult {
  sleeve: SleeveCode | null; // null = genuinely unmapped, no rule and no override
  method: "crypto_rule" | "cash_rule" | "property_rule" | "override" | "unmapped";
}

// Investment-property names currently in Kubera (Lloyd's personal portfolio).
// A name match here, not a Kubera field — Kubera has no "is this real estate"
// flag on an asset, this is the same kind of explicit list the app already
// uses elsewhere (e.g. lib/parse.ts's institution list) rather than a guess.
const PROPERTY_NAME_PATTERNS = [/tyquin st/i, /ashby crt/i, /powlett st/i];

/**
 * Automatic classification only — does not consult sleeve_overrides (the
 * caller merges those in, since overrides are per (portfolio, asset id) and
 * this function is pure/sync for easy testing).
 */
export function classifyHolding(asset: KuberaAssetLike): ClassifyResult {
  if (PROPERTY_NAME_PATTERNS.some((re) => re.test(asset.name))) {
    return { sleeve: "property", method: "property_rule" };
  }
  if (asset.assetClass === "crypto") {
    return { sleeve: "btc_crypto", method: "crypto_rule" };
  }
  if (asset.assetClass === "cash") {
    return { sleeve: "dry_powder", method: "cash_rule" };
  }
  return { sleeve: null, method: "unmapped" };
}
