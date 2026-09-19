import type { CategorySuggestion } from "@/lib/categorise";

export const ING_PROPERTY_CATEGORY = "Investment";

/**
 * Interest and fees charged on the ING investment loan get their own root
 * category. The bank's own wording ("INTEREST CHARGED", "LATE PAYMENT FEE")
 * doesn't name the loan, so this keys off the account's institution instead:
 * anything ING categorised as a Fees item is loan cost.
 */
export function applyIngLoanCategory<T extends Pick<CategorySuggestion, "category" | "sub_category" | "type">>(
  institutionName: string,
  suggestion: T,
  description: string
): T {
  if (!/\bING\b/i.test(institutionName) || suggestion.category !== "Fees") return suggestion;
  return {
    ...suggestion,
    category: ING_PROPERTY_CATEGORY,
    sub_category: /FEE/i.test(description) ? "Loan Fees" : "Loan Interest",
    type: "bills_fixed",
  };
}
