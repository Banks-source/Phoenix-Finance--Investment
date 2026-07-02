// Locked category taxonomy — see PRD.md §7. Source of truth for seeding
// the `categories` table and for the categorisation engine's type lookup.

export type TxnType =
  | "spending"
  | "bills_fixed"
  | "transfers"
  | "debt"
  | "income"
  | "needs_categorisation";

export interface CategoryDef {
  name: string;
  type: TxnType;
  notes?: string;
}

export const CATEGORIES: CategoryDef[] = [
  { name: "Dining Out", type: "spending" },
  { name: "Shopping", type: "spending" },
  { name: "Groceries", type: "spending" },
  { name: "Kids", type: "spending", notes: "Childcare sub-category is a candidate to move to Bills/Fixed later" },
  { name: "Health", type: "spending" },
  { name: "Travel", type: "spending" },
  { name: "Personal Care", type: "spending" },
  { name: "Pets", type: "spending" },
  { name: "Entertainment", type: "spending" },
  { name: "Donations", type: "spending" },
  { name: "Gambling", type: "spending" },
  { name: "Fines", type: "spending" },
  { name: "Car & Transport", type: "spending", notes: "Car Loan / Loan sub-categories are type=debt, not spending" },
  { name: "Transport", type: "spending", notes: "Merge candidate with Car & Transport — not merged in v1" },
  { name: "Subscriptions", type: "bills_fixed" },
  { name: "Rent", type: "bills_fixed" },
  { name: "Insurance", type: "bills_fixed" },
  { name: "Utilities", type: "bills_fixed" },
  { name: "Bills", type: "bills_fixed", notes: "Generic catch-all" },
  { name: "Fees", type: "bills_fixed" },
  { name: "Investment", type: "transfers", notes: "Property capital, land tax, ASIC — was miscategorised as an expense historically" },
  { name: "Money Movement", type: "transfers", notes: "Ashby Loan and Cash Withdrawal sub-categories are needs_categorisation" },
  { name: "Income", type: "income" },
  { name: "Financial", type: "needs_categorisation" },
];

export const CATEGORY_TYPE: Record<string, TxnType> = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, c.type])
);

// Sub-category-level overrides applied on top of the category default.
export function resolveType(category: string, subCategory?: string | null): TxnType {
  if (category === "Car & Transport" && (subCategory === "Car Loan" || subCategory === "Loan")) {
    return "debt";
  }
  if (
    category === "Money Movement" &&
    (subCategory === "Ashby Loan" || subCategory === "Cash Withdrawl" || subCategory === "Cash Withdrawal")
  ) {
    return "needs_categorisation";
  }
  return CATEGORY_TYPE[category] ?? "needs_categorisation";
}

export const TYPE_LABELS: Record<TxnType, string> = {
  spending: "Spending",
  bills_fixed: "Bills / Fixed",
  transfers: "Transfers",
  debt: "Debt",
  income: "Income",
  needs_categorisation: "Needs categorisation",
};

// Institution → owner rule, confirmed 2026-07-02: NAB accounts are Lloyd's,
// CBA accounts are Milani's. Applied in the combined single-store model
// (see SOLUTION_DESIGN.md §4).
export function resolveOwner(institution: string): "lloyd" | "milani" {
  return institution.toUpperCase().includes("CBA") || institution.toUpperCase().includes("CAB")
    ? "milani"
    : "lloyd";
}
