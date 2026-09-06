import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllocationSummary } from "@/lib/allocation";
import { evaluateAllHardRules, RuleResult } from "@/lib/hardRules";
import { KillCriterionAnswer, QuarterlyReviewRecord, EXAMPLE_KILL_CRITERIA, generateReviewMarkdown } from "@/lib/quarterlyReview";

// Server-only data access for the quarterly review workflow (#6). Kept
// separate from lib/quarterlyReview.ts (pure types/constants/markdown gen)
// so a "use client" component can import the pure parts without pulling in
// next/headers via createServiceClient.

/** Seeds kill_criteria_templates with the example list if the table is empty. Safe to re-run. */
export async function ensureKillCriteriaTemplatesSeeded(): Promise<void> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase.from("kill_criteria_templates").select("id").limit(1);
  if (existing && existing.length > 0) return;
  const rows = EXAMPLE_KILL_CRITERIA.map((text, i) => ({ sort_order: i, text, is_example: true }));
  const { error } = await supabase.from("kill_criteria_templates").insert(rows);
  if (error) throw error;
}

/** Starts a new review: pre-computes steps 1-2 (allocation + hard rules), snapshots the current kill-criteria templates. */
export async function startQuarterlyReview(): Promise<{
  reviewId: string;
  allocation: Awaited<ReturnType<typeof fetchAllocationSummary>>;
  hardRules: RuleResult[];
  killCriteria: KillCriterionAnswer[];
}> {
  await ensureKillCriteriaTemplatesSeeded();
  const supabase = createServiceClient();

  const [allocation, hardRules, { data: templates }] = await Promise.all([
    fetchAllocationSummary(),
    evaluateAllHardRules(),
    supabase.from("kill_criteria_templates").select("text").order("sort_order", { ascending: true }),
  ]);

  const killCriteria: KillCriterionAnswer[] = (templates ?? []).map((t) => ({
    text: t.text,
    status: "not_assessed",
    note: "",
  }));

  const { data: created, error } = await supabase
    .from("quarterly_reviews")
    .insert({ kill_criteria: killCriteria })
    .select("id")
    .single();
  if (error) throw error;

  return { reviewId: created.id, allocation, hardRules, killCriteria };
}

export async function saveQuarterlyReviewProgress(
  reviewId: string,
  patch: Partial<{
    cycleInputsNotes: string;
    killCriteria: KillCriterionAnswer[];
    actionsNotes: string;
  }>
): Promise<void> {
  const supabase = createServiceClient();
  const update: Record<string, unknown> = {};
  if (patch.cycleInputsNotes !== undefined) update.cycle_inputs_notes = patch.cycleInputsNotes;
  if (patch.killCriteria !== undefined) update.kill_criteria = patch.killCriteria;
  if (patch.actionsNotes !== undefined) update.actions_notes = patch.actionsNotes;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase.from("quarterly_reviews").update(update).eq("id", reviewId);
  if (error) throw error;
}

export async function completeQuarterlyReview(reviewId: string, elapsedSeconds: number): Promise<{ markdownLog: string }> {
  const supabase = createServiceClient();
  const { data: review, error } = await supabase.from("quarterly_reviews").select("*").eq("id", reviewId).single();
  if (error) throw error;

  const hardRules = await evaluateAllHardRules();
  const markdownLog = generateReviewMarkdown(
    {
      startedAt: review.started_at,
      elapsedSeconds,
      cycleInputsNotes: review.cycle_inputs_notes,
      killCriteria: review.kill_criteria,
      actionsNotes: review.actions_notes,
    },
    hardRules
  );

  const { error: updateError } = await supabase
    .from("quarterly_reviews")
    .update({ completed_at: new Date().toISOString(), elapsed_seconds: elapsedSeconds, markdown_log: markdownLog, archived: true })
    .eq("id", reviewId);
  if (updateError) throw updateError;

  return { markdownLog };
}

export async function fetchReviewHistory(): Promise<QuarterlyReviewRecord[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("quarterly_reviews")
    .select("id, started_at, completed_at, elapsed_seconds, cycle_inputs_notes, kill_criteria, actions_notes, markdown_log, archived")
    .order("started_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    elapsedSeconds: r.elapsed_seconds,
    cycleInputsNotes: r.cycle_inputs_notes,
    killCriteria: r.kill_criteria,
    actionsNotes: r.actions_notes,
    markdownLog: r.markdown_log,
    archived: r.archived,
  }));
}

/**
 * Current status of every kill criterion — from the most recently
 * *completed* review if one exists, otherwise the live template list, all
 * "not_assessed" (nothing scanned yet). For /api/agent/v1/kill-criteria.
 */
export async function fetchKillCriteriaStatus(): Promise<KillCriterionAnswer[]> {
  await ensureKillCriteriaTemplatesSeeded();
  const supabase = createServiceClient();

  const { data: lastCompleted } = await supabase
    .from("quarterly_reviews")
    .select("kill_criteria")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastCompleted) return lastCompleted.kill_criteria as KillCriterionAnswer[];

  const { data: templates } = await supabase.from("kill_criteria_templates").select("text").order("sort_order", { ascending: true });
  return (templates ?? []).map((t) => ({ text: t.text, status: "not_assessed" as const, note: "" }));
}
