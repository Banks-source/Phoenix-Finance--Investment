import { createServiceClient } from "@/lib/supabase/server";
import { fetchHardRuleParams } from "@/lib/hardRules";
import { THESIS_SLEEVES, SLEEVE_LABELS, SleeveCode } from "@/lib/sleeves";

export interface ThesisSleeveBand {
  sleeve: SleeveCode;
  label: string;
  minPct: number | null;
  maxPct: number | null;
}

export interface KillCriterionTemplate {
  id: string;
  text: string;
  sortOrder: number;
  isExample: boolean;
}

export interface ThesisData {
  notes: string | null;
  sleeves: ThesisSleeveBand[];
  hardRuleParams: Awaited<ReturnType<typeof fetchHardRuleParams>>;
  killCriteriaTemplates: KillCriterionTemplate[];
}

export async function fetchThesisData(): Promise<ThesisData> {
  const supabase = createServiceClient();
  const [{ data: notesRow }, { data: targets }, hardRuleParams, { data: templates }] = await Promise.all([
    supabase.from("thesis_notes").select("notes").eq("id", "main").maybeSingle(),
    supabase.from("sleeve_targets").select("sleeve, min_pct, max_pct"),
    fetchHardRuleParams(),
    supabase.from("kill_criteria_templates").select("id, text, sort_order, is_example").order("sort_order", { ascending: true }),
  ]);

  const targetBySleeve = new Map((targets ?? []).map((t) => [t.sleeve, t]));
  const sleeves: ThesisSleeveBand[] = THESIS_SLEEVES.map((sleeve) => {
    const t = targetBySleeve.get(sleeve);
    return { sleeve, label: SLEEVE_LABELS[sleeve], minPct: t ? Number(t.min_pct) : null, maxPct: t ? Number(t.max_pct) : null };
  });

  return {
    notes: notesRow?.notes ?? null,
    sleeves,
    hardRuleParams,
    killCriteriaTemplates: (templates ?? []).map((t) => ({ id: t.id, text: t.text, sortOrder: t.sort_order, isExample: t.is_example })),
  };
}
