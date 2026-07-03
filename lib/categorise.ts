import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, TxnType } from "./taxonomy";
import { ruleCategorise } from "./rules";

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
  method: "exact_rule" | "fuzzy_rule" | "keyword_rule" | "nab_category" | "claude" | "unmatched";
}

function normalizeMerchant(m: string): string {
  return m.trim().toUpperCase().replace(/\s+/g, " ");
}

export { normalizeMerchant };

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

/**
 * Full pipeline for a transaction:
 *   1. Learned merchant_rules (exact/fuzzy from history)
 *   2. Deterministic keyword + bank-category rules (lib/rules.ts) — free, fast
 *   3. Claude API fallback (only if ANTHROPIC_API_KEY is set)
 * Every result still lands as pending_review — no silent auto-categorisation.
 */
export async function categoriseTransaction(
  merchant: string,
  detail: string,
  amount: number,
  rules: MerchantRule[],
  bankCategory?: string | null
): Promise<CategorySuggestion> {
  const ruleMatch = matchRule(merchant, rules);
  if (ruleMatch && ruleMatch.confidence >= 0.9) return ruleMatch;

  const det = ruleCategorise(detail, merchant, bankCategory);
  if (det.method !== "unmatched") {
    return {
      category: det.category,
      sub_category: det.sub_category,
      type: det.type,
      confidence: det.confidence,
      method: det.method,
    };
  }

  // Fall back to the learned fuzzy rule if we had one before trying Claude.
  if (ruleMatch) return ruleMatch;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await categoriseWithClaude(merchant, detail, amount);
    } catch {
      // fall through to unmatched
    }
  }
  return { category: "Financial", sub_category: null, type: "needs_categorisation", confidence: 0, method: "unmatched" };
}

/** Synchronous deterministic-only categorisation (no network). */
export function categoriseSync(
  merchant: string,
  detail: string,
  rules: MerchantRule[],
  bankCategory?: string | null
): CategorySuggestion {
  const ruleMatch = matchRule(merchant, rules);
  if (ruleMatch && ruleMatch.confidence >= 0.9) return ruleMatch;
  const det = ruleCategorise(detail, merchant, bankCategory);
  return {
    category: det.category,
    sub_category: det.sub_category,
    type: det.type,
    confidence: det.confidence,
    method: det.method,
  };
}
