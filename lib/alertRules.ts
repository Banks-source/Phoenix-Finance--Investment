import { createServiceClient } from "@/lib/supabase/server";
import { AlertRule } from "@/lib/alerts/checkBudgetAlerts";

export async function fetchAlertRules(): Promise<AlertRule[]> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("alert_rules").select("*").order("category");
  return (data ?? []) as AlertRule[];
}

export async function createAlertRule(input: {
  category: string;
  channel: "email" | "sms";
  destination: string;
  threshold_pct: number;
}): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("alert_rules").insert(input);
  if (error) return { error: error.message };
  return {};
}

export async function setAlertRuleEnabled(id: string, enabled: boolean): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("alert_rules").update({ enabled }).eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function deleteAlertRule(id: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("alert_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}
