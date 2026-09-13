// Thin delivery layer for budget alerts. Real sending needs a provider —
// set RESEND_API_KEY for email, or TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/
// TWILIO_FROM_NUMBER for SMS. Without those, this logs what *would* have
// been sent instead of silently pretending it worked or throwing.

export interface SendResult {
  sent: boolean;
  reason?: string;
}

export async function sendEmailAlert(to: string, subject: string, body: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[alerts] RESEND_API_KEY not set — would email ${to}: "${subject}"\n${body}`);
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ALERTS_FROM_EMAIL ?? "alerts@phoenix-finance.app",
      to,
      subject,
      text: body,
    }),
  });
  if (!res.ok) return { sent: false, reason: `Resend API error: ${res.status}` };
  return { sent: true };
}

export async function sendSmsAlert(to: string, body: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.log(`[alerts] Twilio env vars not set — would text ${to}: ${body}`);
    return { sent: false, reason: "Twilio not configured" };
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) return { sent: false, reason: `Twilio API error: ${res.status}` };
  return { sent: true };
}
