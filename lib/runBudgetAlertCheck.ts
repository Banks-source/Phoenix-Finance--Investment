import { createServiceClient } from "@/lib/supabase/server";
import { fetchAlertRules } from "@/lib/alertRules";
import { fetchCategoryBudgets, fetchMonthSpendByCategory } from "@/lib/budgets";
import { findTriggeredAlerts, formatAlertMessage } from "@/lib/alerts/checkBudgetAlerts";
import { sendEmailAlert, sendSmsAlert } from "@/lib/alerts/notify";

export interface BudgetAlertCheckResult {
  checked: number;
  triggered: number;
  sent: number;
  alreadyFiredThisPeriod: number;
  results: { category: string; channel: string; destination: string; sent: boolean; reason?: string }[];
}

/** period is "YYYY-MM" so an alert fires at most once per category/rule per month. */
function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function runBudgetAlertCheck(): Promise<BudgetAlertCheckResult> {
  const supabase = createServiceClient();
  const now = new Date();
  const [rules, budgets, spend] = await Promise.all([
    fetchAlertRules(),
    fetchCategoryBudgets(),
    fetchMonthSpendByCategory(now.getFullYear(), now.getMonth() + 1),
  ]);

  const triggered = findTriggeredAlerts(rules, spend, budgets);
  const period = currentPeriod();

  const results: BudgetAlertCheckResult["results"] = [];
  let sent = 0;
  let alreadyFired = 0;

  for (const t of triggered) {
    const { data: existing } = await supabase
      .from("alert_events")
      .select("id")
      .eq("alert_rule_id", t.rule.id)
      .eq("period", period)
      .maybeSingle();
    if (existing) {
      alreadyFired++;
      continue;
    }

    const { subject, body } = formatAlertMessage(t);
    const result =
      t.rule.channel === "email" ? await sendEmailAlert(t.rule.destination, subject, body) : await sendSmsAlert(t.rule.destination, body);

    if (result.sent) {
      await supabase.from("alert_events").insert({ alert_rule_id: t.rule.id, period });
      sent++;
    }
    results.push({ category: t.rule.category, channel: t.rule.channel, destination: t.rule.destination, sent: result.sent, reason: result.reason });
  }

  return { checked: rules.length, triggered: triggered.length, sent, alreadyFiredThisPeriod: alreadyFired, results };
}
