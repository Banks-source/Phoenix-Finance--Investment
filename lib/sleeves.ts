// Investment-thesis sleeve mapping (#4) — SOLUTION_DESIGN.md §9.2.
// Six thesis sleeves, plus two buckets that sit outside the thesis itself:
// "property" (investment real estate — doesn't fit any sleeve, tracked as
// its own bucket per Lloyd's call) and "legacy" (holdings that don't
// confidently match anything — reviewed manually, never guessed, same
// principle as merchant categorisation elsewhere in the app).

export type SleeveCode =
  | "btc_crypto"
  | "ai_tech_materials"
  | "em_equity"
  | "health_biotech"
  | "dry_powder"
  | "metals"
  | "property"
  | "legacy";

export const SLEEVE_LABELS: Record<SleeveCode, string> = {
  btc_crypto: "BTC / Crypto",
  ai_tech_materials: "AI/Tech + Materials",
  em_equity: "EM Equity",
  health_biotech: "Health/Biotech",
  dry_powder: "Dry Powder",
  metals: "Metals",
  property: "Property",
  legacy: "Legacy / unmapped",
};

/** The 6 real thesis sleeves — excludes property and legacy, which sit outside the thesis. */
export const THESIS_SLEEVES: SleeveCode[] = [
  "btc_crypto",
  "ai_tech_materials",
  "em_equity",
  "health_biotech",
  "dry_powder",
  "metals",
];

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
