// Historical rental-property schedules — reference data (read-only).
//
// Mirrors the rental schedule in the taxation booklets / agent statements:
// rent income less deductible expenses (interest, rates, water, land tax,
// agent fees, repairs, insurance, loan fees, depreciation) = net rent, where a
// negative net rent is a deductible loss (negative gearing).
//
// Figures are extracted from the property workbooks and agent folio summaries
// in `tax-history/properties/**` and `tax-history/property-sales/**`. Where a
// year only has the agent-side rent/fees (interest/rates not yet reconciled) the
// net rent is left blank and flagged — do not treat a blank net as $0.
// AU financial years are named by their END year (FY2025 = year ended 30 Jun 2025).

export type RentalProperty = "ashby" | "ocean_grove";

/** Expense lines in booklet display order. Amounts stored positive ($ spent). */
export const RENTAL_EXPENSE_ORDER = [
  "Interest",
  "Council rates",
  "Water",
  "Land tax",
  "Agent / management fees",
  "Repairs & maintenance",
  "Insurance",
  "Loan fees",
  "Depreciation",
  "Other",
] as const;
export type RentalExpense = (typeof RENTAL_EXPENSE_ORDER)[number];

export interface RentalYear {
  fy: number; // FY end year
  /** Gross rent received ($, positive). */
  rentIncome?: number;
  /** Deductible expenses ($, positive). */
  expenses: Partial<Record<RentalExpense, number>>;
  /**
   * Net rent as lodged / from the P&L ($; negative = deductible loss). If
   * omitted it is computed as rentIncome − sum(expenses) only when the expense
   * set is complete (`expensesComplete`).
   */
  netRent?: number;
  /** True when the expense lines above are the full schedule (net can be trusted). */
  expensesComplete?: boolean;
  flags?: string[];
  source: string;
}

export interface RentalHistory {
  property: RentalProperty;
  label: string;
  address: string;
  owners: string;
  note?: string;
  years: RentalYear[];
}

export const RENTAL_HISTORY: RentalHistory[] = [
  {
    property: "ashby",
    label: "Ashby Court",
    address: "18 Ashby Ct, Altona Meadows VIC",
    owners: "Lloyd & Milani (joint)",
    note: "Long-term rental managed by Beyond Property. Loan with BOM (FY22) then ING (FY26).",
    years: [
      {
        fy: 2022,
        rentIncome: 18000,
        expenses: {
          Interest: 13378.61,
          "Council rates": 829.05,
          Water: 615.88,
          "Repairs & maintenance": 2765,
          Insurance: 352.72,
          "Agent / management fees": 180,
          "Loan fees": 367,
        },
        netRent: -488.26,
        expensesComplete: true,
        flags: [
          "Rent $18,000 is from Lloyd's summary workbook; the Beyond Property agent folio for FY22 shows $15,000 collected — confirm the $3,000 difference (part-year / directly-received rent).",
          "Depreciation was left as '?' in the workbook — a capital-works/plant claim would deepen the loss beyond −$488. Confirm the quantity surveyor schedule with the accountant.",
        ],
        source: "properties/ashby-crt/ashby_summary_2022.xlsx (+ ashby_rental_summary_2022.pdf)",
      },
      {
        fy: 2023,
        rentIncome: 23500,
        expenses: {
          "Agent / management fees": 235,
        },
        expensesComplete: false,
        flags: [
          "Only the Beyond Property agent folio is captured (rent $23,500, management fee $235). Loan interest, council rates, water and insurance for FY23 are not yet reconciled, so net rent is not shown.",
        ],
        source: "properties/ashby-crt/ashby_rental_statement_2023.pdf",
      },
      {
        fy: 2025,
        rentIncome: 25000,
        expenses: {
          "Agent / management fees": 250,
          "Repairs & maintenance": 86.9,
        },
        expensesComplete: false,
        flags: [
          "Only the Beyond Property agent folio is captured (rent $25,000, management fee $250, maintenance $86.90). Loan interest, rates, water and insurance for FY25 are not yet reconciled, so net rent is not shown.",
          "The FY24 agent statement PDF (ashby_rental_statement_2024.pdf) contains the FY23 period on its face — the FY24 figures are missing/mislabelled and need to be re-sourced.",
        ],
        source: "properties/ashby-crt/ashby_rental_summary_2025.pdf",
      },
    ],
  },
  {
    property: "ocean_grove",
    label: "Ocean Grove",
    address: "91 The Terrace, Ocean Grove VIC",
    owners: "Lloyd (Inalaa Pty Ltd ownership unresolved)",
    note: "Airbnb short-stay in FY24, then long-term rent in FY25. Heavily negatively geared.",
    years: [
      {
        fy: 2024,
        rentIncome: 22588.88,
        expenses: {},
        netRent: 18028.93,
        expensesComplete: false,
        flags: [
          "FY24 was Airbnb short-stay income (Sep 2023 – Mar 2024): gross $22,588.88, net $18,028.93 per the rental financial summary. The associated interest/expenses are not itemised here — confirm whether FY24 was already negatively geared (a loss may have been claimable that year too).",
        ],
        source: "property-sales/ocean-grove/og_rental_financial_summary.pdf",
      },
      {
        fy: 2025,
        rentIncome: 33142,
        expenses: {
          Interest: 98083.05,
          Water: 568,
          "Council rates": 1723,
          "Agent / management fees": 3182,
          "Land tax": 1037,
        },
        netRent: -71451.05,
        expensesComplete: true,
        flags: [
          "The OG.xlsx P&L nets to −$71,451 (rent $33,142 less interest $98,083, water $568, rates $1,723, agent $3,182, land tax $1,037). The FY25 personal return lodged a supplementary loss of −$58,317 — confirm the ~$13k difference (interest not fully claimed, or other supplementary income netted).",
          "Whether this loss belongs on Lloyd's personal return depends on the unresolved Inalaa Pty Ltd ownership.",
        ],
        source: "property-sales/ocean-grove/OG.xlsx",
      },
    ],
  },
];

/** All FY end years present across the rental history, ascending. */
export function rentalHistoryFys(): number[] {
  const set = new Set<number>();
  for (const p of RENTAL_HISTORY) for (const y of p.years) set.add(y.fy);
  return [...set].sort((a, b) => a - b);
}

/** Sum of expense lines for a year. */
export function rentalExpenseTotal(y: RentalYear): number {
  return RENTAL_EXPENSE_ORDER.reduce((s, k) => s + (y.expenses[k] ?? 0), 0);
}

/** Net rent for a year: explicit value if set, else computed when complete. */
export function rentalNetRent(y: RentalYear): number | null {
  if (y.netRent != null) return y.netRent;
  if (y.expensesComplete && y.rentIncome != null) return y.rentIncome - rentalExpenseTotal(y);
  return null;
}
