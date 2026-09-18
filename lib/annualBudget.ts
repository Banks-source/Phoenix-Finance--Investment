export type PaceStatus = "under" | "on_target" | "over";

export interface AnnualPace {
  annualBudget: number;
  ytdSpent: number;
  expectedToDate: number; // what a steady spend would have reached by now
  projected: number; // full-year total if the current pace holds
  deviationPct: number; // + = ahead of pace (spending faster), - = behind
  status: PaceStatus;
}

// Within this band of the expected pace still reads as "on target".
export const ON_TARGET_BAND_PCT = 5;

/** How much of `year` has elapsed by `today`: 0 for a future year, 1 for a past one. */
export function yearFraction(year: number, today: Date): number {
  if (year < today.getFullYear()) return 1;
  if (year > today.getFullYear()) return 0;
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1); // count today as elapsed
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

export function computeAnnualPace(monthlyBudgetTotal: number, ytdSpent: number, fraction: number): AnnualPace {
  const annualBudget = monthlyBudgetTotal * 12;
  const expectedToDate = annualBudget * fraction;
  const projected = fraction > 0 ? ytdSpent / fraction : 0;
  const deviationPct = expectedToDate > 0 ? ((ytdSpent - expectedToDate) / expectedToDate) * 100 : 0;
  const status: PaceStatus =
    Math.abs(deviationPct) <= ON_TARGET_BAND_PCT ? "on_target" : deviationPct > 0 ? "over" : "under";
  return { annualBudget, ytdSpent, expectedToDate, projected, deviationPct, status };
}
