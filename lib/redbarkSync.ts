import { createServiceClient } from "@/lib/supabase/server";
import { listConnections, listAccounts, listTransactions, getBalance, RedbarkAccount, RedbarkTransaction } from "@/lib/redbark";
import { categoriseSync, MerchantRule } from "@/lib/categorise";
import { classifyMoneyMovement, extractAccountDigits, needsBufferDecision } from "@/lib/transferClassification";
import { applyIngLoanCategory } from "@/lib/ingProperty";
import { resolveIncomeSubCategory, Owner } from "@/lib/incomeClassification";

export type RedbarkSyncResult = {
  imported: number;
  skippedDuplicates: number;
  unmappedAccounts: { id: string; name: string; institution: string }[];
  perAccount: { accountId: string; name: string; imported: number }[];
  balanceErrors: { name: string; message: string }[];
  // Which connections the API key can see, and how many accounts each returned.
  // Last 4 chars of the key and the API version in use, to spot env mismatches.
  credentials: { keySuffix: string; version: string | null };
  connections: { name: string; status: string; category: string; accounts: number }[];
};

export const DETAIL_COLUMNS = [
  "bank_txn_id",
  "posted_at",
  "post_date",
  "reference",
  "extended_description",
  "provider_category",
  "merchant_category_code",
  "bank_status",
] as const;

/** The extra Redbark fields we keep on each transaction for the detail view. */
export function redbarkDetailColumns(t: RedbarkTransaction) {
  return {
    bank_txn_id: t.id,
    posted_at: t.post_datetime ?? t.datetime ?? null,
    post_date: t.post_date ?? null,
    reference: t.reference ?? null,
    extended_description: t.extended_description ?? null,
    provider_category: t.provider_category ?? null,
    merchant_category_code: t.merchant_category_code ?? null,
    bank_status: t.status ?? null,
  };
}


/** Redbark amounts are unsigned minor units (cents) plus a direction; ours are signed dollars. */
export function redbarkAmount(t: RedbarkTransaction): number {
  const signed = t.direction === "debit" ? -Math.abs(t.amount.amount) : Math.abs(t.amount.amount);
  return signed / 100;
}

export interface ImportContext {
  institution: string;
  owner: string;
  accountId: string;
  merchantRules: MerchantRule[];
  ourAccountDigits: string[];
}

/** The transactions row for one Redbark transaction — always lands in review. */
export function buildImportRow(t: RedbarkTransaction, ctx: ImportContext) {
  const amount = redbarkAmount(t);
  const s = applyIngLoanCategory(
    ctx.institution,
    categoriseSync(t.merchant_name ?? t.description, t.description, ctx.merchantRules, t.provider_category),
    t.description
  );
  // "Money Movement" alone doesn't say whether the money stayed in the
  // household or actually left it — classify that direction here, on
  // the raw bank description, rather than guessing later with less context.
  const baseSubCategory =
    s.category === "Money Movement" && !s.sub_category
      ? classifyMoneyMovement(t.description, ctx.ourAccountDigits) ?? s.sub_category
      : s.category === "Income"
        ? resolveIncomeSubCategory(t.description, ctx.owner as Owner)
        : s.sub_category;
  // Big Westpac buffer moves need a human call: paydown vs temporary top-up.
  const subCategory =
    s.category === "Money Movement" && needsBufferDecision(t.description, amount) ? "Needs review" : baseSubCategory;
  return {
    date: t.date,
    amount,
    account_id: ctx.accountId,
    owner: ctx.owner,
    transaction_type: t.direction,
    detail: t.description,
    merchant: t.merchant_name ?? t.description,
    category: s.category,
    sub_category: subCategory,
    type: s.type,
    status: "pending_review", // always — no silent auto-categorisation
    confidence: s.confidence,
    source: "bank_import",
    ...redbarkDetailColumns(t),
  };
}

export function stripDetailColumns(row: Record<string, unknown>) {
  const out = { ...row };
  for (const c of DETAIL_COLUMNS) delete out[c];
  return out;
}

export function isMissingColumn(error: { code?: string }): boolean {
  return error.code === "42703" || error.code === "PGRST204";
}

const OVERLAP_DAYS = 3; // re-fetch a few days of overlap so a slow-settling transaction isn't missed

function daysAgoIso(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Syncs every connected banking account from Redbark. Deliberately refuses to
// guess account ownership — the Redbark API returns no account-holder name
// (CDR data is privacy-scoped), so any account without an explicit row in
// redbark_account_owners is skipped and reported, never silently attributed.
export async function runRedbarkSync(): Promise<RedbarkSyncResult> {
  const supabase = createServiceClient();

  const { data: ownerRows } = await supabase.from("redbark_account_owners").select("redbark_account_id, owner");
  const ownerMap = new Map((ownerRows ?? []).map((r) => [r.redbark_account_id, r.owner]));

  const { data: rules } = await supabase.from("merchant_rules").select("*");
  const merchantRules = (rules ?? []) as MerchantRule[];

  // PostgREST caps a select at 1000 rows, and this table has grown well past
  // that — an unpaginated fetch here silently missed most existing rows and
  // let real duplicate transactions get re-inserted on sync.
  const existing: { date: string; amount: number; detail: string | null; owner: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("transactions")
      .select("date, amount, detail, owner")
      .range(from, from + 999);
    if (error) throw new Error(`existing transactions fetch failed: ${error.message}`);
    existing.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const seen = new Set(existing.map((e) => `${e.date}|${e.amount}|${e.detail}|${e.owner}`));
  // A joint account's activity may already be stored under either spouse (from
  // their own feed or an earlier import), so for joint accounts an identical
  // date|amount|detail under *any* owner counts as already imported. Not done
  // for individual accounts, where identical same-day rows can be genuine.
  const seenAnyOwner = new Set(existing.map((e) => `${e.date}|${e.amount}|${e.detail}`));

  const { data: accountRows } = await supabase.from("accounts").select("account_label, account_number_masked");
  const ourAccountDigits = extractAccountDigits(...(accountRows ?? []).flatMap((a) => [a.account_label, a.account_number_masked]));

  const connections = await listConnections();
  const bankingAccounts: RedbarkAccount[] = [];
  const connectionsSeen: RedbarkSyncResult["connections"] = [];
  for (const conn of connections) {
    if (conn.status !== "active" || conn.category !== "banking") continue;
    const accts = await listAccounts(conn.id);
    bankingAccounts.push(...accts);
    connectionsSeen.push({ name: conn.institution?.name ?? conn.id, status: conn.status, category: conn.category, accounts: accts.length });
  }

  const result: RedbarkSyncResult = {
    imported: 0,
    skippedDuplicates: 0,
    unmappedAccounts: [],
    perAccount: [],
    balanceErrors: [],
    credentials: {
      keySuffix: (process.env.REDBARK_API_KEY ?? "").slice(-4),
      version: process.env.REDBARK_API_VERSION ?? null,
    },
    connections: connectionsSeen,
  };

  for (const acct of bankingAccounts) {
    const owner = ownerMap.get(acct.id);
    if (!owner) {
      result.unmappedAccounts.push({ id: acct.id, name: acct.name, institution: acct.institution.name });
      continue;
    }

    const { data: existingAccountRow } = await supabase
      .from("accounts")
      .select("id, redbark_last_synced_at")
      .eq("redbark_account_id", acct.id)
      .maybeSingle();

    let accountId: string;
    let from: string | undefined;
    if (existingAccountRow) {
      accountId = existingAccountRow.id;
      from = existingAccountRow.redbark_last_synced_at
        ? daysAgoIso(new Date(existingAccountRow.redbark_last_synced_at), OVERLAP_DAYS)
        : undefined;
    } else {
      const { data: created, error } = await supabase
        .from("accounts")
        .insert({
          institution: acct.institution.name,
          account_label: acct.name,
          account_number_masked: acct.account_number,
          owner,
          redbark_account_id: acct.id,
        })
        .select("id")
        .single();
      if (error) throw new Error(`accounts insert failed: ${error.message}`);
      accountId = created.id;
    }

    // Bank logo for the dashboard. Separate from the balance update below so a
    // missing column (migration 0017 not yet applied) can't lose the balance.
    if (acct.institution.logo) {
      await supabase.from("accounts").update({ institution_logo: acct.institution.logo }).eq("id", accountId);
    }

    const txns = await listTransactions(acct.id, { from, includePending: false });
    const toInsert: any[] = [];
    for (const t of txns) {
      const amount = redbarkAmount(t);
      const key = `${t.date}|${amount}|${t.description}|${owner}`;
      if (seen.has(key) || (owner === "joint" && seenAnyOwner.has(`${t.date}|${amount}|${t.description}`))) {
        result.skippedDuplicates++;
        continue;
      }
      seen.add(key);
      toInsert.push(
        buildImportRow(t, { institution: acct.institution.name, owner, accountId, merchantRules, ourAccountDigits })
      );
    }

    if (toInsert.length > 0) {
      let { error } = await supabase.from("transactions").insert(toInsert);
      // Migration 0018 (detail columns) not applied yet — import without them.
      if (error && isMissingColumn(error)) {
        ({ error } = await supabase.from("transactions").insert(toInsert.map(stripDetailColumns)));
      }
      if (error) throw new Error(`transactions insert failed: ${error.message}`);
    }

    // Live balance — kept on the account for the dashboard, plus a daily
    // snapshot so balance history accumulates without a separate job. A
    // balance failure shouldn't lose the transactions we just imported.
    try {
      const balance = await getBalance(acct.id);
      const current = balance.current.amount / 100;
      const available = balance.available ? balance.available.amount / 100 : null;
      await supabase
        .from("accounts")
        .update({
          redbark_last_synced_at: new Date().toISOString(),
          balance_current: current,
          balance_available: available,
          balance_observed_at: balance.observed_at,
        })
        .eq("id", accountId);
      await supabase
        .from("balance_snapshots")
        .upsert(
          { account_id: accountId, observed_on: balance.observed_at.slice(0, 10), current, available },
          { onConflict: "account_id,observed_on" }
        );
    } catch (err) {
      result.balanceErrors.push({ name: acct.name, message: err instanceof Error ? err.message : "Unknown error" });
      await supabase.from("accounts").update({ redbark_last_synced_at: new Date().toISOString() }).eq("id", accountId);
    }

    result.imported += toInsert.length;
    result.perAccount.push({ accountId: acct.id, name: acct.name, imported: toInsert.length });
  }

  return result;
}

/**
 * One-off: fills the detail columns on transactions imported before migration
 * 0018. Matches on the same date|amount|detail|owner key the importer dedups
 * with; only touches rows that don't have a bank_txn_id yet.
 */
export async function backfillTransactionDetails(since = "2026-01-01") {
  const supabase = createServiceClient();
  const { data: ownerRows } = await supabase.from("redbark_account_owners").select("redbark_account_id, owner");
  const ownerMap = new Map((ownerRows ?? []).map((r) => [r.redbark_account_id, r.owner]));

  const missing = new Map<string, string>(); // key -> transaction id
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, date, amount, detail, owner")
      .is("bank_txn_id", null)
      .eq("source", "bank_import")
      .gte("date", since)
      .range(from, from + 999);
    if (error) throw new Error(`backfill fetch failed: ${error.message}`);
    for (const r of data ?? []) missing.set(`${r.date}|${r.amount}|${r.detail}|${r.owner}`, r.id);
    if (!data || data.length < 1000) break;
  }

  let updated = 0;
  const connections = await listConnections();
  const accounts: RedbarkAccount[] = [];
  for (const conn of connections) {
    if (conn.status !== "active" || conn.category !== "banking") continue;
    accounts.push(...(await listAccounts(conn.id)).filter((a) => ownerMap.has(a.id)));
  }

  // Accounts fetched in parallel, then updates applied in parallel chunks —
  // sequential single-row updates were slow enough to time out the route.
  const perAccount = await Promise.all(
    accounts.map(async (acct) => ({ acct, txns: await listTransactions(acct.id, { from: since, includePending: false }) }))
  );
  const work: { id: string; cols: ReturnType<typeof redbarkDetailColumns> }[] = [];
  for (const { acct, txns } of perAccount) {
    const owner = ownerMap.get(acct.id);
    for (const t of txns) {
      const signed = t.direction === "debit" ? -Math.abs(t.amount.amount) : Math.abs(t.amount.amount);
      const key = `${t.date}|${signed / 100}|${t.description}|${owner}`;
      const id = missing.get(key);
      if (!id) continue;
      missing.delete(key);
      work.push({ id, cols: redbarkDetailColumns(t) });
    }
  }
  for (let i = 0; i < work.length; i += 25) {
    const results = await Promise.all(
      work.slice(i, i + 25).map((w) => supabase.from("transactions").update(w.cols).eq("id", w.id))
    );
    for (const r of results) {
      if (r.error) throw new Error(`backfill update failed: ${r.error.message}`);
      updated++;
    }
  }
  return { updated, unmatched: missing.size };
}
