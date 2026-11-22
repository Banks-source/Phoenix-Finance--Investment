import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, TxnType } from "./taxonomy";
import { ruleCategorise } from "./rules";
import { candidateKeys } from "./payeeKey";

export interface MerchantRule {
  merchant_pattern: string;
  category: string;
  sub_category: string | null;
  type: TxnType;
  match_count: number;
  /** user = you set it; confirmed = you approved it as-is; history = inferred from past approvals. Missing = legacy (treated as user). */
  source?: "user" | "confirmed" | "history" | null;
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

const SOURCE_CONFIDENCE = { user: 0.97, confirmed: 0.93, history: 0.8 } as const;

function suggestionFrom(r: MerchantRule, method: CategorySuggestion["method"]): CategorySuggestion {
  const src = r.source ?? "user";
  return {
    category: r.category,
    sub_category: r.sub_category,
    type: r.type,
    confidence: method === "fuzzy_rule" ? Math.min(SOURCE_CONFIDENCE[src], 0.9) - 0.01 : SOURCE_CONFIDENCE[src],
    method,
  };
}

/**
 * Learned payee memory. Rules are keyed on a clean payee key (lib/payeeKey.ts),
 * so "COLES 4420 COOLUM BEACH" and "Coles 8758 Peregian Sprs, Card xx1075" both
 * hit the same rule. Falls back to the first word of the payee when a rule was
 * learned on just that word ("COLES"), and to the legacy raw-text key.
 */
export function matchRule(merchant: string, rules: MerchantRule[], detail?: string | null): CategorySuggestion | null {
  if (!rules.length) return null;
  const byKey = new Map<string, MerchantRule>();
  for (const r of rules) {
    const k = normalizeMerchant(r.merchant_pattern);
    const prev = byKey.get(k);
    if (!prev || r.match_count > prev.match_count) byKey.set(k, r);
  }

  const keys = candidateKeys(merchant, detail);
  for (const k of keys) {
    const hit = byKey.get(k);
    if (hit) return suggestionFrom(hit, "exact_rule");
  }
  const legacy = byKey.get(normalizeMerchant(merchant));
  if (legacy) return suggestionFrom(legacy, "exact_rule");

  for (const k of keys) {
    const first = k.split(" ")[0];
    if (first.length >= 4 && first !== k && !first.startsWith("TRANSFER")) {
      const hit = byKey.get(first);
      if (hit) return suggestionFrom(hit, "fuzzy_rule");
    }
  }
  return null;
}

const isTrusted = (s: CategorySuggestion | null, rules: MerchantRule[]) => !!s && s.confidence >= 0.9 && rules.length > 0;

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
    category: parsed.category ?? "Uncategorised",
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
  const ruleMatch = matchRule(merchant, rules, detail);
  if (isTrusted(ruleMatch, rules)) return ruleMatch!; // your own rules beat the built-in ones

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
  return { category: "Uncategorised", sub_category: null, type: "spending", confidence: 0, method: "unmatched" };
}

/** Synchronous deterministic-only categorisation (no network). */
export function categoriseSync(
  merchant: string,
  detail: string,
  rules: MerchantRule[],
  bankCategory?: string | null
): CategorySuggestion {
  const ruleMatch = matchRule(merchant, rules, detail);
  if (isTrusted(ruleMatch, rules)) return ruleMatch!; // your own rules beat the built-in ones
  const det = ruleCategorise(detail, merchant, bankCategory);
  if (det.method === "unmatched" && ruleMatch) return ruleMatch; // history-derived guess beats nothing
  return {
    category: det.category,
    sub_category: det.sub_category,
    type: det.type,
    confidence: det.confidence,
    method: det.method,
  };
}
