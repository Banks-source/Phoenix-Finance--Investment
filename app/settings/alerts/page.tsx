import { PageHeader } from "@/components/ui";
import AlertRulesManager from "@/components/AlertRulesManager";
import { CATEGORIES } from "@/lib/taxonomy";
import { EXPENSE_TYPES } from "@/lib/fy";
import { fetchAlertRules } from "@/lib/alertRules";

export const dynamic = "force-dynamic";

export default async function AlertsSettingsPage() {
  const rules = await fetchAlertRules();
  const expenseCategoryNames = CATEGORIES.filter((c) => EXPENSE_TYPES.includes(c.type as (typeof EXPENSE_TYPES)[number])).map(
    (c) => c.name
  );

  const emailConfigured = !!process.env.RESEND_API_KEY;
  const smsConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget Alerts"
        subtitle="Get notified when a category crosses a % of its monthly budget. Checked once a day."
      />

      {(!emailConfigured || !smsConfigured) && (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {!emailConfigured && <p>Email alerts need a RESEND_API_KEY set in Vercel — until then, triggered emails just log to the server console.</p>}
          {!smsConfigured && <p className="mt-1">SMS alerts need TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER — until then, triggered texts just log to the server console.</p>}
        </div>
      )}

      <AlertRulesManager rules={rules} categories={expenseCategoryNames} />
    </div>
  );
}
