import type { CategorySuggestion } from "@/lib/categorise";

export const ING_PROPERTY_CATEGORY = "Investment";

/**
 * Interest and fees charged on the ING loan (the Residential Mortgage account)
 * are the cost of the investment property, so they go to Investment. The
 * bank's wording ("INTEREST CHARGED", "LATE PAYMENT FEE") doesn't name the
 * loan, so this keys off the account: only the ING loan account qualifies —
 * a fee on the ING Orange Everyday account stays an ordinary fee.
 */
export function applyIngLoanCategory<T extends Pick<CategorySuggestion, "category" | "sub_category" | "type">>(
  institutionName: string,
  accountName: string | null | undefined,
  suggestion: T,
  description: string
): T {
  if (!/\bING\b/i.test(institutionName) || !/mortgage|loan/i.test(accountName ?? "") || suggestion.category !== "Fees") {
    return suggestion;
  }
  return {
    ...suggestion,
    category: ING_PROPERTY_CATEGORY,
    sub_category: /FEE/i.test(description) ? "Loan Fees" : "Loan Interest",
    type: "bills_fixed",
  };
}
