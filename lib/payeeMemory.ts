import { createServiceClient } from "@/lib/supabase/server";
import { MerchantRule } from "@/lib/categorise";
import { payeeKey, candidateKeys, UNLEARNABLE_CATEGORIES } from "@/lib/payeeKey";
import { resolveType, TxnType } from "@/lib/taxonomy";

// The categorisation memory: what you've told the app about each payee.
//   user      – you set the category/sub-category yourself (always wins)
//   confirmed – you approved the row as it was categorised
//   history   – inferred from what you've already approved
// One rule per payee key (lib/payeeKey.ts). A rule you set is never silently
// overwritten by a confirmation or an inference — only by another edit of yours.

type Supa = ReturnType<typeof createServiceClient>;
export type RuleSource = "user" | "confirmed" | "history";

const CHUNK = 200;

export async function pageAll<T>(build: (s: Supa) => any, supabase: Supa = createServiceClient()): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(supabase).range(from, from + 999);
    if (error) throw new Error(error.message ?? JSON.stringify(error));
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export function loadMerchantRules(supabase: Supa = createServiceClient()): Promise<MerchantRule[]> {
  return pageAll<MerchantRule>((s) => s.from("merchant_rules").select("*").order("id"), supabase);
}

export interface LearnInput {
  merchant: string | null;
  detail: string | null;
  category: string | null;
  sub_category: string | null;
}

export interface LearnedRule {
  key: string;
  category: string;
  sub_category: string | null;
  type: TxnType;
}

/** One rule per payee from a batch of rows: the most common (category, sub-category) wins. */
export function ruleCandidates(inputs: LearnInput[], source: RuleSource): LearnedRule[] {
  const tally = new Map<string, Map<string, { n: number; category: string; sub: string | null }>>();
  for (const r of inputs) {
    if (!r.category || UNLEARNABLE_CATEGORIES.has(r.category)) continue;
    if (source !== "user" && r.category === "Money Movement") continue; // transfers are the movement engine's job
    const key = payeeKey(r.merchant, r.detail);
    if (key.length < 3) continue;
    const combo = `${r.category}\u0000${r.sub_category ?? ""}`;
    const byCombo = tally.get(key) ?? tally.set(key, new Map()).get(key)!;
    const e = byCombo.get(combo) ?? { n: 0, category: r.category, sub: r.sub_category };
    e.n++;
    byCombo.set(combo, e);
  }
  const out: LearnedRule[] = [];
  for (const [key, byCombo] of tally) {
    const best = [...byCombo.values()].sort((a, b) => b.n - a.n)[0];
    out.push({ key, category: best.category, sub_category: best.sub, type: resolveType(best.category, best.sub) });
  }
  return out;
}

async function upsertRules(supabase: Supa, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  let { error } = await supabase.from("merchant_rules").upsert(rows, { onConflict: "merchant_pattern" });
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    // migration 0026 not applied yet — save without the new columns
    const plain = rows.map(({ source, sample, updated_at, ...rest }) => rest);
    ({ error } = await supabase.from("merchant_rules").upsert(plain, { onConflict: "merchant_pattern" }));
  }
  if (error) throw new Error(error.message);
}

/** Remember these categorisations. Returns the rules that were written (changed or newly learned). */
export async function learnPayees(
  inputs: (LearnInput & { sample?: string | null })[],
  source: RuleSource,
  supabase: Supa = createServiceClient()
): Promise<LearnedRule[]> {
  const candidates = ruleCandidates(inputs, source);
  if (!candidates.length) return [];
  const sampleByKey = new Map<string, string>();
  for (const r of inputs) {
    const k = payeeKey(r.merchant, r.detail);
    if (k && !sampleByKey.has(k)) sampleByKey.set(k, (r.detail ?? r.merchant ?? "").slice(0, 160));
  }

  const existing = new Map<string, { source?: string | null; category: string; sub_category: string | null; match_count: number }>();
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const { data } = await supabase
      .from("merchant_rules")
      .select("*")
      .in("merchant_pattern", candidates.slice(i, i + CHUNK).map((c) => c.key));
    for (const r of data ?? []) existing.set(r.merchant_pattern, r);
  }

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  const written: LearnedRule[] = [];
  for (const c of candidates) {
    const prev = existing.get(c.key);
    const prevSource = prev ? (prev.source ?? "user") : null;
    const sameAnswer = !!prev && prev.category === c.category && (prev.sub_category ?? null) === c.sub_category;
    const outranked = prevSource === "user" && source !== "user";
    const weakerThanConfirmed = prevSource === "confirmed" && source === "history";
    if ((outranked || weakerThanConfirmed) && !sameAnswer) continue;

    rows.push({
      merchant_pattern: c.key,
      category: c.category,
      sub_category: c.sub_category,
      type: c.type,
      match_count: (prev?.match_count ?? 0) + 1,
      last_used: now,
      updated_at: now,
      sample: sampleByKey.get(c.key) ?? null,
      // an answer you already gave keeps its (stronger) source
      source: sameAnswer && (prevSource === "user" || (prevSource === "confirmed" && source === "history")) ? prevSource : source,
    });
    if (!sameAnswer) written.push(c);
  }
  await upsertRules(supabase, rows);
  return written;
}

/**
 * After you teach the app a payee, update the not-yet-approved transactions
 * from that payee too — so one correction fixes the whole queue.
 */
export async function applyRulesToPending(
  learned: LearnedRule[],
  skipIds: Set<string> = new Set(),
  supabase: Supa = createServiceClient()
): Promise<number> {
  if (!learned.length) return 0;
  const byKey = new Map(learned.map((l) => [l.key, l]));
  const pending = await pageAll<{ id: string; merchant: string | null; detail: string | null; category: string | null; sub_category: string | null }>(
    (s) => s.from("transactions").select("id,merchant,detail,category,sub_category").eq("status", "pending_review").order("id"),
    supabase
  );

  const groups = new Map<string, { rule: LearnedRule; ids: string[] }>();
  for (const t of pending) {
    if (skipIds.has(t.id)) continue;
    const rule = candidateKeys(t.merchant, t.detail).map((k) => byKey.get(k)).find(Boolean);
    if (!rule) continue;
    if (t.category === rule.category && (t.sub_category ?? null) === rule.sub_category) continue;
    const g = groups.get(rule.key) ?? groups.set(rule.key, { rule, ids: [] }).get(rule.key)!;
    g.ids.push(t.id);
  }

  let updated = 0;
  for (const { rule, ids } of groups.values()) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { error } = await supabase
        .from("transactions")
        .update({ category: rule.category, sub_category: rule.sub_category, type: rule.type })
        .in("id", ids.slice(i, i + CHUNK));
      if (error) throw new Error(error.message);
      updated += Math.min(CHUNK, ids.length - i);
    }
  }
  return updated;
}

/** Payees you've consistently approved the same way — a rule for each (≥2 rows, ≥80% agreement). */
export function seedFromHistory(rows: LearnInput[]): LearnedRule[] {
  const eligible = rows.filter(
    (r) => r.category && !["Income", "Money Movement"].includes(r.category) && !UNLEARNABLE_CATEGORIES.has(r.category)
  );
  const byKey = new Map<string, LearnInput[]>();
  for (const r of eligible) {
    const key = payeeKey(r.merchant, r.detail);
    if (key.length < 3) continue;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(r);
  }
  const out: LearnedRule[] = [];
  for (const [key, group] of byKey) {
    if (group.length < 2) continue;
    const cats = new Map<string, number>();
    for (const r of group) cats.set(r.category!, (cats.get(r.category!) ?? 0) + 1);
    const [category, n] = [...cats.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n / group.length < 0.8) continue;
    const inCat = group.filter((r) => r.category === category);
    const subs = new Map<string, number>();
    for (const r of inCat) subs.set(r.sub_category ?? "", (subs.get(r.sub_category ?? "") ?? 0) + 1);
    const [sub, sn] = [...subs.entries()].sort((a, b) => b[1] - a[1])[0];
    const sub_category = sub && sn / inCat.length >= 0.8 ? sub : null;
    out.push({ key, category, sub_category, type: resolveType(category, sub_category) });
  }
  return out;
}

export interface RebuildResult {
  legacyRekeyed: number;
  legacyDropped: number;
  seeded: number;
  totalRules: number;
}

/**
 * One-off tidy + seed: re-key the old raw-text rules onto payee keys (they
 * rarely matched anything), then add 'history' rules from approved transactions.
 */
export async function rebuildMemory(supabase: Supa = createServiceClient()): Promise<RebuildResult> {
  const old = await pageAll<MerchantRule & { id: string; last_used?: string }>((s) => s.from("merchant_rules").select("*").order("id"), supabase);
  const now = new Date().toISOString();

  // 1. re-key legacy rules (those without a source) — newest answer per key wins
  const rekeyed = new Map<string, { rule: MerchantRule; n: number; last: string }>();
  const keepIds = new Set<string>();
  let dropped = 0;
  for (const r of old) {
    if (r.source) {
      keepIds.add(r.id);
      continue;
    }
    const key = payeeKey(r.merchant_pattern, null);
    if (key.length < 3 || UNLEARNABLE_CATEGORIES.has(r.category)) {
      dropped++;
      continue;
    }
    const prev = rekeyed.get(key);
    const last = r.last_used ?? "";
    if (!prev) rekeyed.set(key, { rule: r, n: r.match_count, last });
    else rekeyed.set(key, { rule: last > prev.last ? r : prev.rule, n: prev.n + r.match_count, last: last > prev.last ? last : prev.last });
  }

  const existingKeys = new Set(old.filter((r) => r.source).map((r) => r.merchant_pattern));
  const rows: Record<string, unknown>[] = [];
  for (const [key, { rule, n }] of rekeyed) {
    if (existingKeys.has(key)) continue;
    rows.push({
      merchant_pattern: key,
      category: rule.category,
      sub_category: rule.sub_category,
      type: rule.type,
      match_count: n,
      last_used: now,
      updated_at: now,
      sample: rule.merchant_pattern.slice(0, 160),
      source: "user",
    });
    existingKeys.add(key);
  }

  // 2. infer from approved history
  const approved = await pageAll<LearnInput>(
    (s) => s.from("transactions").select("merchant,detail,category,sub_category").eq("status", "approved").order("id"),
    supabase
  );
  const seeds = seedFromHistory(approved).filter((s) => !existingKeys.has(s.key));
  for (const s of seeds) {
    rows.push({
      merchant_pattern: s.key,
      category: s.category,
      sub_category: s.sub_category,
      type: s.type,
      match_count: 1,
      last_used: now,
      updated_at: now,
      sample: null,
      source: "history",
    });
  }

  for (let i = 0; i < rows.length; i += 500) await upsertRules(supabase, rows.slice(i, i + 500));

  // 3. remove the old raw-text rows that have been replaced
  const stale = old.filter((r) => !r.source && !keepIds.has(r.id)).map((r) => r.id);
  for (let i = 0; i < stale.length; i += CHUNK) {
    const { error } = await supabase.from("merchant_rules").delete().in("id", stale.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
  }

  return {
    legacyRekeyed: rekeyed.size,
    legacyDropped: dropped,
    seeded: seeds.length,
    totalRules: existingKeys.size,
  };
}
