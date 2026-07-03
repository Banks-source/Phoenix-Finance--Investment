// Historical personal tax claims — reference data (read-only).
//
// Two sides the app can show:
//   • "Submitted"  — the deduction line items Lloyd/Milani gave the tax agent,
//                    extracted from the personal workbooks in `tax-history/personal/**`.
//   • "Assessed"   — the ATO outcome (taxable income, refund) from the assessment
//                    notices / PAYG summaries, as captured in
//                    `tax-history/claims-patterns-analysis.md`.
//
// Category-level *as-lodged* figures (the consolidated booklets) are OCR of
// scanned forms and mostly cover the entities, so where the agent lodged the
// workbook unchanged, "claimed" == "submitted". Discrepancies are flagged.
// AU financial years are named by their END year (FY2025 = year ended 30 Jun 2025).

export type ClaimPerson = "lloyd" | "milani";

/** Normalised deduction buckets, in display order. */
export const CLAIM_CATEGORY_ORDER = [
  "Phone & internet",
  "Subscriptions & software",
  "Home office & tech",
  "Car & transport",
  "Work from home",
  "Education",
  "Donations",
  "Managing tax affairs",
  "Other",
] as const;
export type ClaimCategory = (typeof CLAIM_CATEGORY_ORDER)[number];

export interface ClaimYear {
  fy: number; // FY end year
  /** Submitted deductions by normalised category ($, positive). */
  lines: Partial<Record<ClaimCategory, number>>;
  /** Sum of the lines above (what was submitted). */
  submittedTotal: number;
  wfhHours?: number; // work-from-home hours (method basis, later years)
  carKm?: number; // logbook / cents-per-km distance
  // Assessed side (ATO), where documented.
  grossWages?: number;
  paygWithheld?: number;
  taxableIncome?: number;
  refund?: number;
  flags?: string[];
  source: string;
}

export interface ClaimHistory {
  person: ClaimPerson;
  label: string;
  years: ClaimYear[];
}

export const CLAIMS_HISTORY: ClaimHistory[] = [
  {
    person: "lloyd",
    label: "Lloyd",
    years: [
      {
        fy: 2021,
        lines: {
          "Phone & internet": 961.2,
          "Subscriptions & software": 837.64,
          "Home office & tech": 2238,
          "Car & transport": 217,
          "Work from home": 1680,
          Education: 200,
          "Managing tax affairs": 3073.42,
        },
        submittedTotal: 9207.26,
        carKm: 900,
        source: "personal/lloyd/2021/p4_lloyd_personal_2021.xlsx",
      },
      {
        fy: 2022,
        lines: {
          "Phone & internet": 1551.5,
          "Subscriptions & software": 1163,
          "Home office & tech": 4627,
          "Car & transport": 291,
          "Work from home": 1920,
          Education: 1615,
          Donations: 184,
          "Managing tax affairs": 4946,
          Other: 2035, // SMSF setup $1,540 + property advice $495
        },
        submittedTotal: 18332.5,
        grossWages: 183446.51,
        paygWithheld: 56680,
        source: "personal/lloyd/2022/lloyd_personal_2022.xlsx",
      },
      {
        fy: 2023,
        lines: {
          "Phone & internet": 2113.83,
          "Subscriptions & software": 4447.19,
          "Home office & tech": 1544.83,
          "Car & transport": 446,
          Donations: 166.5,
          "Managing tax affairs": 3520, // accountant $3,421 + Koinly $99
        },
        submittedTotal: 12238.35,
        wfhHours: 1890,
        carKm: 1500,
        grossWages: 184993.47,
        paygWithheld: 57284,
        source: "personal/lloyd/2023/lloyd_personal_2023.xlsx",
      },
      {
        fy: 2024,
        lines: {
          "Phone & internet": 2057.96, // mobile/internet $1,930.56 + website $127.40
          "Subscriptions & software": 2575.36,
          "Car & transport": 562.41,
          Education: 3033.06, // Real Vision
          "Managing tax affairs": 3848.3, // Joe fees $3,751 + Koinly $97.30
          Other: 69.95, // Equifax
        },
        submittedTotal: 12147.04,
        wfhHours: 1890,
        carKm: 1500,
        grossWages: 196873.6,
        paygWithheld: 63030,
        flags: [
          "Workbook's Tech-block total ($9,873 + Education $3,033) doesn't reconcile to the itemised lines — an unlabelled ~$759 'Transport' subtotal in the sheet didn't match its car lines. Verify the FY24 total with the accountant.",
        ],
        source: "personal/lloyd/2024/lloyd_personal_fy2024.xlsx",
      },
      {
        fy: 2025,
        lines: {
          "Phone & internet": 1470, // mobile/internet $1,400 + domain $70
          "Subscriptions & software": 2304,
          "Car & transport": 1012, // parking $280 + car hire $394 + tolls $149 + taxi $189
          "Managing tax affairs": 3751, // Joe fees
          Other: 952, // ASIC fees
        },
        submittedTotal: 9489,
        wfhHours: 1890,
        carKm: 2500,
        grossWages: 222418.2,
        paygWithheld: 73084,
        taxableIncome: 158335,
        refund: 30013.35,
        flags: [
          "Assessed taxable income $158,335 sits well below gross wages $222,418 — the driver is the Ocean Grove rental loss (−$71,451), not these ~$9.5k work deductions. Confirm the loss belongs on Lloyd's personal return (Ocean Grove / Inalaa Pty Ltd ownership is unresolved).",
        ],
        source: "personal/lloyd/2025/lloyd_personal_2025.xlsx",
      },
    ],
  },
  {
    person: "milani",
    label: "Milani",
    years: [
      {
        fy: 2021,
        lines: {
          "Phone & internet": 961.2,
          "Car & transport": 88, // taxi $48 + parking $40
          "Work from home": 921.6,
          "Managing tax affairs": 110,
        },
        submittedTotal: 2080.8,
        flags: ["Workbook's printed total ($1,159) excludes the $922 work-from-home line shown here."],
        source: "personal/milani/2021/p4_milani_taxes_2021.xlsx",
      },
      {
        fy: 2022,
        lines: {
          "Phone & internet": 620.6,
          "Car & transport": 78, // taxi $48 + parking $30
          "Work from home": 896,
          "Managing tax affairs": 110,
        },
        submittedTotal: 1704.6,
        grossWages: 40733,
        paygWithheld: 6303,
        flags: ["Workbook's printed total ($809) excludes the $896 work-from-home line shown here."],
        source: "personal/milani/2022/milani_taxes_2022.xlsx",
      },
      {
        fy: 2023,
        lines: {
          "Phone & internet": 884.4, // Telstra
          "Car & transport": 225, // parking $135 + taxi/uber $90
          "Managing tax affairs": 110,
        },
        submittedTotal: 1219.4,
        wfhHours: 1440,
        carKm: 3500,
        grossWages: 77110.27,
        paygWithheld: 17124,
        source: "personal/milani/2023/milani_expenses_fy2023.xlsx",
      },
      {
        fy: 2024,
        lines: {},
        submittedTotal: 0,
        flags: ["No FY2024 workbook was located for Milani — this year is a gap to fill from the accountant's records."],
        source: "(missing — no FY2024 folder)",
      },
      {
        fy: 2025,
        lines: {
          "Phone & internet": 1100, // Telstra
          "Car & transport": 179, // parking $89 + taxi/uber $90
          "Managing tax affairs": 110,
        },
        submittedTotal: 1389,
        wfhHours: 1440,
        carKm: 3500,
        grossWages: 82145.28,
        paygWithheld: 17112,
        taxableIncome: 38990,
        refund: 13654.3,
        flags: [
          "Assessed taxable income $38,990 is ~$43k below gross wages $82,145 — the driver is NOT these ~$1.4k work deductions and is not traced to a source document. Confirm the composition with the accountant.",
        ],
        source: "personal/milani/2025/milani_expenses_2025.xlsx",
      },
    ],
  },
];

/** All FY end years present across the history, ascending. */
export function claimsHistoryFys(): number[] {
  const set = new Set<number>();
  for (const p of CLAIMS_HISTORY) for (const y of p.years) set.add(y.fy);
  return [...set].sort((a, b) => a - b);
}
