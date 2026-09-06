import { SleeveCode } from "@/lib/sleeves";

// Forward-looking portfolio projections. Pure compounding math — no live
// data here, so it's fully testable with plain numbers. Reference only, not
// advice: a projection is an assumption made visible, not a forecast.

export type ProjectionGroup = "personal" | "retirement";

export interface ProjectionInput {
  currentAge: number;
  targetAges: number[]; // e.g. [65, 75, 85]
  groupSleeveBalances: Record<ProjectionGroup, Partial<Record<SleeveCode, number>>>;
  groupOtherAssetsAud: Record<ProjectionGroup, number>; // property + legacy + unmapped, combined
  sleeveGrowthRatesPct: Partial<Record<SleeveCode, number>>; // annual %, per sleeve
  otherAssetsGrowthPct: number; // annual %, applied to groupOtherAssetsAud
  monthlyContributions: Record<ProjectionGroup, number>;
  sleeveWeights: Partial<Record<SleeveCode, number>>; // how new contributions split across sleeves (normalized internally); all-zero falls back to putting contributions in dry_powder
}

export interface ProjectionPoint {
  targetAge: number;
  yearsOut: number;
  personalAud: number;
  retirementAud: number;
  combinedAud: number;
}

/** Future value of a lump sum plus a level monthly contribution, compounded monthly. */
function futureValue(presentValue: number, monthlyRate: number, months: number, monthlyContribution: number): number {
  if (months <= 0) return presentValue;
  const growth = Math.pow(1 + monthlyRate, months);
  const fvOfPv = presentValue * growth;
  const fvOfContributions = monthlyRate === 0 ? monthlyContribution * months : monthlyContribution * ((growth - 1) / monthlyRate);
  return fvOfPv + fvOfContributions;
}

export function projectForwardValues(input: ProjectionInput): ProjectionPoint[] {
  const groups: ProjectionGroup[] = ["personal", "retirement"];

  let totalWeight = Object.values(input.sleeveWeights).reduce((s, w) => s + (w ?? 0), 0);
  let weights = input.sleeveWeights;
  if (totalWeight <= 0) {
    // No target bands set anywhere — new money just sits as cash until sleeves are targeted.
    weights = { dry_powder: 1 };
    totalWeight = 1;
  }

  return input.targetAges.map((targetAge) => {
    const yearsOut = targetAge - input.currentAge;
    const months = Math.max(0, yearsOut) * 12;

    const groupTotals: Record<ProjectionGroup, number> = { personal: 0, retirement: 0 };
    for (const g of groups) {
      const contribution = input.monthlyContributions[g] ?? 0;
      let total = 0;
      const sleeves = Object.keys(input.groupSleeveBalances[g] ?? {}) as SleeveCode[];
      const allSleeves = new Set<SleeveCode>([...sleeves, ...(Object.keys(weights) as SleeveCode[])]);
      for (const sleeve of allSleeves) {
        const pv = input.groupSleeveBalances[g]?.[sleeve] ?? 0;
        const annualRate = input.sleeveGrowthRatesPct[sleeve] ?? 0;
        const monthlyRate = annualRate / 100 / 12;
        const weight = (weights[sleeve] ?? 0) / totalWeight;
        const pmt = contribution * weight;
        total += futureValue(pv, monthlyRate, months, pmt);
      }
      const otherPv = input.groupOtherAssetsAud[g] ?? 0;
      const otherMonthlyRate = input.otherAssetsGrowthPct / 100 / 12;
      total += futureValue(otherPv, otherMonthlyRate, months, 0);
      groupTotals[g] = total;
    }

    return {
      targetAge,
      yearsOut,
      personalAud: groupTotals.personal,
      retirementAud: groupTotals.retirement,
      combinedAud: groupTotals.personal + groupTotals.retirement,
    };
  });
}
