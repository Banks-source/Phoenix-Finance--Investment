export interface AlertRule {
  id: string;
  category: string;
  channel: "email" | "sms";
  destination: string;
  threshold_pct: number;
  enabled: boolean;
}

export interface TriggeredAlert {
  rule: AlertRule;
  spent: number;
  budget: number;
  pct: number;
}

/**
 * Pure decision logic: given current spend/budget per category and the
 * configured rules, which rules have crossed their threshold this month?
 * A rule with no budget set for its category never fires (nothing to
 * measure against, so there's nothing to silently guess at).
 */
export function findTriggeredAlerts(
  rules: AlertRule[],
  spentByCategory: Record<string, number>,
  budgetByCategory: Record<string, number>
): TriggeredAlert[] {
  const triggered: TriggeredAlert[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const budget = budgetByCategory[rule.category];
    if (!budget || budget <= 0) continue;
    const spent = spentByCategory[rule.category] ?? 0;
    const pct = (spent / budget) * 100;
    if (pct >= rule.threshold_pct) {
      triggered.push({ rule, spent, budget, pct });
    }
  }
  return triggered;
}

export function formatAlertMessage(t: TriggeredAlert): { subject: string; body: string } {
  const pctRounded = Math.round(t.pct);
  return {
    subject: `Phoenix Finance: ${t.rule.category} is at ${pctRounded}% of budget`,
    body: `${t.rule.category} spend this month is $${t.spent.toFixed(2)} of a $${t.budget.toFixed(2)} budget (${pctRounded}%).`,
  };
}
