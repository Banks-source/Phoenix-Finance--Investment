// ATO claim buckets for the FY tax pack — see SOLUTION_DESIGN_TAX.md §3–§4.
// Mirrors the `tax_categories` seed in migration 0002. `suggestFrom` maps the
// app's internal spending categories (PRD §7) to a likely tax bucket so the
// claims builder can pre-suggest — the human always decides (no auto-claiming).

export type TaxSchedule = "individual" | "rental" | "business" | "not_deductible";

export interface TaxCategoryDef {
  code: string;
  label: string;
  schedule: TaxSchedule;
  deductible: boolean;
  /** Internal category names (transactions.category) that hint at this bucket. */
  suggestFrom?: string[];
}

export const TAX_CATEGORIES: TaxCategoryDef[] = [
  // Individual — work-related personal deductions (feed the FY estimate column)
  { code: "wr_phone", label: "Phone & internet", schedule: "individual", deductible: true },
  { code: "wr_subscriptions", label: "Subscriptions & software", schedule: "individual", deductible: true, suggestFrom: ["Subscriptions"] },
  { code: "wr_car_parking", label: "Car & transport — Parking", schedule: "individual", deductible: true },
  { code: "wr_car_rideshare", label: "Car & transport — Taxi & rideshare", schedule: "individual", deductible: true },
  { code: "wr_car_tolls", label: "Car & transport — Road tolls", schedule: "individual", deductible: true },
  { code: "wr_car_other", label: "Car & transport — Other", schedule: "individual", deductible: true, suggestFrom: ["Car & Transport", "Transport"] },
  { code: "wr_education", label: "Education", schedule: "individual", deductible: true },
  // Individual — ATO D-item codes (kept for anything already tagged / other claims)
  { code: "d1_car", label: "Work-related car", schedule: "individual", deductible: true },
  { code: "d2_travel", label: "Work-related travel", schedule: "individual", deductible: true, suggestFrom: ["Travel"] },
  { code: "d3_clothing", label: "Work-related clothing & laundry", schedule: "individual", deductible: true },
  { code: "d4_self_education", label: "Self-education", schedule: "individual", deductible: true },
  { code: "d5_other_work", label: "Other work-related expenses", schedule: "individual", deductible: true },
  { code: "d9_gifts", label: "Gifts & donations", schedule: "individual", deductible: true, suggestFrom: ["Donations"] },
  { code: "d10_managing_tax", label: "Cost of managing tax affairs", schedule: "individual", deductible: true, suggestFrom: ["Fees"] },
  { code: "d_interest_dividend", label: "Interest / dividend deductions", schedule: "individual", deductible: true },
  // Rental schedule
  { code: "rental_interest", label: "Rental — loan interest", schedule: "rental", deductible: true },
  { code: "rental_rates", label: "Rental — council rates", schedule: "rental", deductible: true },
  { code: "rental_water", label: "Rental — water", schedule: "rental", deductible: true },
  { code: "rental_land_tax", label: "Rental — land tax", schedule: "rental", deductible: true },
  { code: "rental_agent", label: "Rental — agent fees / commission", schedule: "rental", deductible: true },
  { code: "rental_repairs", label: "Rental — repairs & maintenance", schedule: "rental", deductible: true },
  { code: "rental_insurance", label: "Rental — insurance", schedule: "rental", deductible: true, suggestFrom: ["Insurance"] },
  { code: "rental_depreciation", label: "Rental — capital works / depreciation", schedule: "rental", deductible: true },
  { code: "rental_other", label: "Rental — other expenses", schedule: "rental", deductible: true, suggestFrom: ["Utilities"] },
  // Business / entity
  { code: "business_expense", label: "Business / entity expense", schedule: "business", deductible: true, suggestFrom: ["Investment"] },
  { code: "asic_fees", label: "ASIC / company fees", schedule: "business", deductible: true },
  // Non-deductible
  { code: "not_deductible", label: "Not deductible (private/domestic)", schedule: "not_deductible", deductible: false },
];

export const TAX_CATEGORY_BY_CODE: Record<string, TaxCategoryDef> = Object.fromEntries(
  TAX_CATEGORIES.map((t) => [t.code, t])
);

export function taxLabel(code?: string | null): string {
  if (!code) return "—";
  return TAX_CATEGORY_BY_CODE[code]?.label ?? code;
}

export function isDeductibleCode(code?: string | null): boolean {
  if (!code) return false;
  return TAX_CATEGORY_BY_CODE[code]?.deductible ?? false;
}

// Maps a tax code to the normalised claim-history category it rolls up into, so
// tagged transactions can seed the FY estimate column in the deductions history.
// Values MUST match CLAIM_CATEGORY_ORDER labels in lib/claimsHistory.ts. Codes
// with no clean 1:1 bucket are omitted (return null → they don't seed a row).
export const CLAIM_CATEGORY_BY_CODE: Record<string, string> = {
  wr_phone: "Phone & internet",
  wr_subscriptions: "Subscriptions & software",
  wr_car_parking: "Car & transport",
  wr_car_rideshare: "Car & transport",
  wr_car_tolls: "Car & transport",
  wr_car_other: "Car & transport",
  wr_education: "Education",
  // legacy D-codes still roll up where unambiguous
  d1_car: "Car & transport",
  d2_travel: "Car & transport",
  d4_self_education: "Education",
  d9_gifts: "Donations",
  d10_managing_tax: "Managing tax affairs",
};

/** Normalised claim-history category a tax code rolls up into, or null. */
export function claimCategoryForCode(code?: string | null): string | null {
  if (!code) return null;
  return CLAIM_CATEGORY_BY_CODE[code] ?? null;
}

// Reverse index: internal category → suggested deductible tax bucket (first match).
const SUGGEST_INDEX: Record<string, string> = {};
for (const t of TAX_CATEGORIES) {
  for (const c of t.suggestFrom ?? []) {
    if (!(c in SUGGEST_INDEX)) SUGGEST_INDEX[c] = t.code;
  }
}

/** Suggested tax bucket code for an internal category, or null if none. */
export function suggestTaxCategory(category?: string | null): string | null {
  if (!category) return null;
  return SUGGEST_INDEX[category] ?? null;
}

/** Internal categories that are claim candidates (have a deductible suggestion). */
export const CLAIM_CANDIDATE_CATEGORIES: Set<string> = new Set(Object.keys(SUGGEST_INDEX));

/** Whether an internal category maps to a deductible bucket — used by the YoY "deductible only" lens. */
export function categoryIsDeductibleLens(category?: string | null): boolean {
  const code = suggestTaxCategory(category);
  return isDeductibleCode(code);
}

/** Deductible buckets grouped by schedule, for building select menus. */
export function deductibleBucketsBySchedule(): { schedule: TaxSchedule; items: TaxCategoryDef[] }[] {
  const order: TaxSchedule[] = ["individual", "rental", "business", "not_deductible"];
  return order.map((schedule) => ({
    schedule,
    items: TAX_CATEGORIES.filter((t) => t.schedule === schedule),
  }));
}

export const SCHEDULE_LABELS: Record<TaxSchedule, string> = {
  individual: "Individual",
  rental: "Rental property",
  business: "Business / entity",
  not_deductible: "Not deductible",
};
