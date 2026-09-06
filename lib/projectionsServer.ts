import { createServiceClient } from "@/lib/supabase/server";
import { fetchClassifiedHoldings } from "@/lib/allocation";
import { convert } from "@/lib/fx";
import { THESIS_SLEEVES, SleeveCode } from "@/lib/sleeves";
import { projectForwardValues, ProjectionGroup, ProjectionPoint } from "@/lib/projections";

const REPORTING_CURRENCY = "AUD";
const TARGET_AGES = [65, 75, 85];

export interface ProjectionSettings {
  currentAge: number | null;
  personalMonthlyContribution: number;
  retirementMonthlyContribution: number;
  otherAssetsGrowthPct: number;
}

export interface ProjectionData {
  settings: ProjectionSettings;
  sleeveGrowthRates: Partial<Record<SleeveCode, number>>;
  currentGroupTotals: { personal: number; retirement: number };
  points: ProjectionPoint[] | null; // null if currentAge isn't set yet
}

export async function fetchProjectionData(): Promise<ProjectionData> {
  const supabase = createServiceClient();
  const [holdings, { data: settingsRow }, { data: growthRows }, { data: targets }] = await Promise.all([
    fetchClassifiedHoldings(),
    supabase.from("projection_settings").select("*").eq("id", "main").maybeSingle(),
    supabase.from("sleeve_growth_rates").select("sleeve, annual_growth_pct"),
    supabase.from("sleeve_targets").select("sleeve, min_pct, max_pct"),
  ]);

  const settings: ProjectionSettings = {
    currentAge: settingsRow?.current_age ?? null,
    personalMonthlyContribution: Number(settingsRow?.personal_monthly_contribution ?? 0),
    retirementMonthlyContribution: Number(settingsRow?.retirement_monthly_contribution ?? 0),
    otherAssetsGrowthPct: Number(settingsRow?.other_assets_growth_pct ?? 0),
  };

  const sleeveGrowthRates: Partial<Record<SleeveCode, number>> = {};
  for (const r of growthRows ?? []) sleeveGrowthRates[r.sleeve as SleeveCode] = Number(r.annual_growth_pct);

  const sleeveWeights: Partial<Record<SleeveCode, number>> = {};
  for (const t of targets ?? []) sleeveWeights[t.sleeve as SleeveCode] = (Number(t.min_pct) + Number(t.max_pct)) / 2;

  const assets = holdings.filter((h) => !h.isDebt);
  const amounts = await Promise.all(assets.map((h) => convert(h.amount, h.currency || REPORTING_CURRENCY, REPORTING_CURRENCY)));

  const groupSleeveBalances: Record<ProjectionGroup, Partial<Record<SleeveCode, number>>> = { personal: {}, retirement: {} };
  const groupOtherAssetsAud: Record<ProjectionGroup, number> = { personal: 0, retirement: 0 };

  assets.forEach((h, i) => {
    const aud = amounts[i];
    const group: ProjectionGroup = h.group === "retirement" ? "retirement" : "personal"; // ungrouped folded into personal for projection purposes
    if (h.sleeve && (THESIS_SLEEVES as string[]).includes(h.sleeve)) {
      groupSleeveBalances[group][h.sleeve] = (groupSleeveBalances[group][h.sleeve] ?? 0) + aud;
    } else {
      // property, legacy, or unmapped — all "other assets" for projection purposes
      groupOtherAssetsAud[group] += aud;
    }
  });

  const currentGroupTotals = {
    personal:
      Object.values(groupSleeveBalances.personal).reduce((s, v) => s + (v ?? 0), 0) + groupOtherAssetsAud.personal,
    retirement:
      Object.values(groupSleeveBalances.retirement).reduce((s, v) => s + (v ?? 0), 0) + groupOtherAssetsAud.retirement,
  };

  const points =
    settings.currentAge == null
      ? null
      : projectForwardValues({
          currentAge: settings.currentAge,
          targetAges: TARGET_AGES,
          groupSleeveBalances,
          groupOtherAssetsAud,
          sleeveGrowthRatesPct: sleeveGrowthRates,
          otherAssetsGrowthPct: settings.otherAssetsGrowthPct,
          monthlyContributions: {
            personal: settings.personalMonthlyContribution,
            retirement: settings.retirementMonthlyContribution,
          },
          sleeveWeights,
        });

  return { settings, sleeveGrowthRates, currentGroupTotals, points };
}
