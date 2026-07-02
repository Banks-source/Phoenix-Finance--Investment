import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, TxnType } from "./taxonomy";

export interface MerchantRule {
  merchant_pattern: string;
  category: string;
  sub_category: string | null;
  type: TxnType;
  match_count: number;
}

export interface CategorySuggestion {
  category: string;
  sub_category: string | null;
  type: TxnType;
  confidence: number; // 0-1
  method: "exact_rule" | "fuzzy_rule" | "claude";
}

function normalizeMerchant(m: string): string {
  return m.trim().toUpperCase().replace(/\s+/g, " ");
}

/** Exact + simple substring match against the learned merchant_rules table. */
export function matchRule(merchant: string, rules: MerchantRule[]): CategorySuggestion | null {
  const norm = normalizeMerchant(merchant);

  const exact = rules.find((r) => normalizeMerchant(r.merchant_pattern) === norm);
  if (exact) {
    return {
      category: exact.category,
      sub_category: exact.sub_category,
      type: exact.type,
      confidence: 0.95,
      method: "exact_rule",
    };
  }

  const fuzzy = rules
    .filter((r) => norm.includes(normalizeMerchant(r.merchant_pattern)) || normalizeMerchant(r.merchant_pattern).includes(norm))
    .sort((a, b) => b.match_count - a.match_count)[0];
  if (fuzzy) {
    return {
      category: fuzzy.category,
      sub_category: fuzzy.sub_category,
      type: fuzzy.type,
      confidence: 0.6,
      method: "fuzzy_rule",
    };
  }

  return null;
}

/**
 * Claude API fallback for merchants with no rule match. Every result still
 * lands in the review queue (status = pending_review) — no silent
 * auto-categorisation regardless of confidence, per the product requirement.
 */
export async function categoriseWithClaude(
  merchant: string,
  detail: string,
  amount: number
): Promise<CategorySuggestion> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const categoryList = CATEGORIES.map((c) => `- ${c.name} (${c.type})`).join("\n");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Categorise this bank transaction into exactly one of the categories below.

Transaction: merchant="${merchant}", detail="${detail}", amount=${amount}

Categories (name and type):
${categoryList}

Respond with strict JSON only: {"category": "...", "sub_category": "... or null", "confidence": 0.0-1.0}`,
      },
    ],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const parsed = JSON.parse(text);
  const def = CATEGORIES.find((c) => c.name === parsed.category);

  return {
    category: parsed.category ?? "Financial",
    sub_category: parsed.sub_category ?? null,
    type: def?.type ?? "needs_categorisation",
    confidence: parsed.confidence ?? 0.4,
    method: "claude",
  };
}

/** Full pipeline: rule match first, Claude fallback second. */
export async function categoriseTransaction(
  merchant: string,
  detail: string,
  amount: number,
  rules: MerchantRule[]
): Promise<CategorySuggestion> {
  const ruleMatch = matchRule(merchant, rules);
  if (ruleMatch && ruleMatch.confidence >= 0.9) return ruleMatch;
  return categoriseWithClaude(merchant, detail, amount);
}
