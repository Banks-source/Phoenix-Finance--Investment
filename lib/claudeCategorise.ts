import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES } from "@/lib/taxonomy";

// Batch categorisation of payees nothing else could place. Each payee is asked
// about once (not each transaction), the answer is only ever a *suggestion* —
// the row stays in Review — and it is never written to the memory: only your
// own edits and approvals teach the app.

export interface PayeeQuestion {
  merchant: string | null;
  detail: string | null;
  /** Money out is negative. */
  amount: number;
}

export interface PayeeAnswer {
  category: string;
  confidence: number;
}

const NOT_FOR_CLAUDE = new Set(["Uncategorised", "Money Movement"]); // transfers are the movement engine's call

export function allowedCategories(moneyIn: boolean): string[] {
  return CATEGORIES.map((c) => c.name).filter((n) => !NOT_FOR_CLAUDE.has(n) && (moneyIn || n !== "Income"));
}

/** Pulls the JSON answer out of the reply and keeps only valid, allowed categories. */
export function parseBatch(text: string, questions: PayeeQuestion[]): Map<number, PayeeAnswer> {
  const out = new Map<number, PayeeAnswer>();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return out;
  }
  if (!Array.isArray(parsed)) return out;
  for (const item of parsed) {
    const i = Number((item as { i?: unknown }).i);
    const category = (item as { category?: unknown }).category;
    const confidence = Number((item as { confidence?: unknown }).confidence);
    if (!Number.isInteger(i) || i < 0 || i >= questions.length || typeof category !== "string") continue;
    if (!allowedCategories(questions[i].amount > 0).includes(category)) continue;
    out.set(i, { category, confidence: Number.isFinite(confidence) ? Math.min(0.85, Math.max(0.1, confidence)) : 0.5 });
  }
  return out;
}

export function buildPrompt(questions: PayeeQuestion[]): string {
  const lines = questions.map((q, i) => {
    const merchant = q.merchant && q.merchant !== q.detail ? `merchant="${q.merchant}" ` : "";
    const dir = q.amount > 0 ? "money in" : "money out";
    return `${i}. ${merchant}description="${(q.detail ?? "").slice(0, 120)}" ${dir} $${Math.abs(q.amount).toFixed(2)}`;
  });
  return `You categorise Australian household bank transactions. Pick exactly one category for each item below.

Categories: ${allowedCategories(true).join(", ")}.
"Income" is only for money in. A refund goes in the category of the original purchase. If you really can't tell, choose the closest category with a low confidence.

${lines.join("\n")}

Reply with ONLY a JSON array, one object per item: [{"i":0,"category":"...","confidence":0.0-1.0}]`;
}

export async function askClaude(questions: PayeeQuestion[]): Promise<Map<number, PayeeAnswer>> {
  if (!questions.length || !process.env.ANTHROPIC_API_KEY) return new Map();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: process.env.CATEGORISE_MODEL || "claude-haiku-5-5",
    max_tokens: 2000,
    messages: [{ role: "user", content: buildPrompt(questions) }],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return parseBatch(text, questions);
}
