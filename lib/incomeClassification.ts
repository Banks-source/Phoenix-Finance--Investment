// Collapses every Income transaction into exactly one of the five sub-categories
// the household actually cares about, rather than the grab-bag of ad-hoc labels
// (Dividend, Refund, Lloyd, Milani, Interest, ...) that accumulated over time.

export type IncomeSubCategory = "Lloyd Salary" | "Milani Salary" | "Rent" | "Taxes" | "Other Income";

export type Owner = "lloyd" | "milani" | "joint";

export function resolveIncomeSubCategory(detail: string | null, owner: Owner): IncomeSubCategory {
  const hay = (detail ?? "").toUpperCase();

  if (hay.includes("SALARY")) {
    if (owner === "lloyd") return "Lloyd Salary";
    if (owner === "milani") return "Milani Salary";
    return "Other Income"; // joint/ambiguous — don't guess which spouse
  }

  if (hay.includes("RENT DISBURSEMENT") || hay.includes("BEYOND PROPERTY")) return "Rent";

  if (/\bATO\b|TAX OFFICE|\bTAX\b/.test(hay)) return "Taxes";

  return "Other Income";
}
