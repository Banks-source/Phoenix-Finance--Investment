// Which transactions count towards spending, budgets and totals.
//   all       – approved AND still-in-review (the default): a view of the month
//               is useful before you've finished reviewing it
//   confirmed – approved only (tax, exports, and the "Confirmed only" toggle)
export type Basis = "all" | "confirmed";

export const statusesFor = (b: Basis): string[] => (b === "confirmed" ? ["approved"] : ["approved", "pending_review"]);

export const parseBasis = (v?: string | null): Basis => (v === "confirmed" ? "confirmed" : "all");
