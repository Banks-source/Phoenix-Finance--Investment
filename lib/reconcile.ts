import { createServiceClient } from "@/lib/supabase/server";
import { listConnections, listAccounts, listTransactions, RedbarkAccount } from "@/lib/redbark";
import { extractAccountDigits } from "@/lib/transferClassification";
import { MerchantRule } from "@/lib/categorise";
import { buildImportRow, redbarkAmount, redbarkDetailColumns, isMissingColumn, stripDetailColumns } from "@/lib/redbarkSync";
import { matchTransactions, findDuplicateExtras, RbTxn, DbTxn } from "@/lib/reconcileMatch";

export const RECONCILE_FROM = "2026-01-01";
// Statement imports can be dated a few days off the bank's date, so look a
// little further back than the year start when pulling the bank side.
const BANK_LOOKBACK = "2025-12-20";

export const REASONS = {
  missing: "In your bank feed but missing from your records",
  orphan: "In your records but not found in your bank feed",
  duplicate: "Possible duplicate — same date, amount and description as another row",
} as const;

export type ReconcileResult = {
  applied: boolean;
  bankTransactions: number;
  storedTransactions: number;
  matched: number;
  linkedToBank: number; // matched rows that will gain their bank id / detail
  datesDiffer: number;
  missingInDb: number;
  missingByMonth: Record<string, number>;
  orphans: number;
  duplicates: number;
  samples: { missing: string[]; orphans: string[]; duplicates: string[] };
};

async function fetchAllDb(supabase: ReturnType<typeof createServiceClient>, cols: string) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("transactions")
      .select(cols)
      .gte("date", RECONCILE_FROM)
      .range(from, from + 999);
    if (error) throw new Error(`transactions fetch failed: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/**
 * Compares the whole 2026 bank feed against the database. Nothing changes
 * unless `apply` is set; then rows found missing are added, suspect rows are
 * flagged, and matched rows are linked to their bank record — everything that
 * needs a human decision lands in Review with a reason.
 */
export async function runReconciliation({ apply }: { apply: boolean }): Promise<ReconcileResult> {
  const supabase = createServiceClient();

  if (apply) {
    const probe = await supabase.from("transactions").select("review_reason").limit(1);
    if (probe.error) throw new Error("Run migration 0022 (review_reason column) before applying a reconciliation.");
  }

  const { data: ownerRows } = await supabase.from("redbark_account_owners").select("redbark_account_id, owner");
  const ownerMap = new Map((ownerRows ?? []).map((r) => [r.redbark_account_id as string, r.owner as string]));
  const { data: accountRows } = await supabase
    .from("accounts")
    .select("id, redbark_account_id, account_label, account_number_masked");
  const dbAccountByRb = new Map((accountRows ?? []).map((a) => [a.redbark_account_id as string, a.id as string]));
  const ourAccountDigits = extractAccountDigits(...(accountRows ?? []).flatMap((a) => [a.account_label, a.account_number_masked]));
  const { data: rules } = await supabase.from("merchant_rules").select("*");
  const merchantRules = (rules ?? []) as MerchantRule[];

  // ---- bank side
  const accounts: RedbarkAccount[] = [];
  for (const conn of await listConnections()) {
    if (conn.status !== "active" || conn.category !== "banking") continue;
    accounts.push(...(await listAccounts(conn.id)).filter((a) => ownerMap.has(a.id)));
  }
  const bank: { acct: RedbarkAccount; t: Awaited<ReturnType<typeof listTransactions>>[number] }[] = [];
  for (const acct of accounts) {
    for (const t of await listTransactions(acct.id, { from: BANK_LOOKBACK, includePending: false })) bank.push({ acct, t });
  }
  const rb: RbTxn[] = bank.map(({ acct, t }) => ({
    id: t.id,
    date: t.date,
    amount: redbarkAmount(t),
    accountId: dbAccountByRb.get(acct.id) ?? null,
  }));
  const bankById = new Map(bank.map((b) => [b.t.id, b]));

  // ---- our side
  const db: (DbTxn & { owner: string; detail: string | null; source: string; status: string })[] = await fetchAllDb(
    supabase,
    "id, date, amount, detail, owner, account_id, source, status, bank_txn_id"
  );
  const dbRows = db.map((r) => ({ ...r, amount: Number(r.amount) }));

  // Bank rows dated before the year only exist to catch date-shifted matches.
  const { matches, missingInDb, unmatchedDb } = matchTransactions(rb, dbRows);
  const missing = missingInDb.filter((t) => t.date >= RECONCILE_FROM);
  const today = new Date().toISOString().slice(0, 10);
  const orphans = unmatchedDb.filter((r) => r.source !== "manual" && r.date <= today);
  const dupExtras = findDuplicateExtras(dbRows).filter((r) => r.source !== "manual");
  const dupIds = new Set(dupExtras.map((r) => r.id));
  const linkable = matches.filter((m) => !m.byId);

  const missingByMonth: Record<string, number> = {};
  for (const t of missing) missingByMonth[t.date.slice(0, 7)] = (missingByMonth[t.date.slice(0, 7)] ?? 0) + 1;

  const describe = (d: string, a: number, text: string | null | undefined) => `${d}  ${a.toFixed(2)}  ${(text ?? "").slice(0, 45)}`;
  const result: ReconcileResult = {
    applied: apply,
    bankTransactions: rb.filter((t) => t.date >= RECONCILE_FROM).length,
    storedTransactions: dbRows.length,
    matched: matches.length,
    linkedToBank: linkable.length,
    datesDiffer: matches.filter((m) => m.shiftDays > 0).length,
    missingInDb: missing.length,
    missingByMonth,
    orphans: orphans.length,
    duplicates: dupExtras.length,
    samples: {
      missing: missing.slice(0, 8).map((t) => describe(t.date, t.amount, bankById.get(t.id)?.t.description)),
      orphans: orphans.slice(0, 8).map((r) => describe(r.date, r.amount, r.detail)),
      duplicates: dupExtras.slice(0, 8).map((r) => describe(r.date, r.amount, r.detail)),
    },
  };
  if (!apply) return result;

  // ---- apply: link matched rows to their bank record
  for (let i = 0; i < linkable.length; i += 25) {
    const results = await Promise.all(
      linkable.slice(i, i + 25).map((m) => {
        const b = bankById.get(m.rb.id)!;
        const cols: Record<string, unknown> = { ...redbarkDetailColumns(b.t) };
        return supabase.from("transactions").update(cols).eq("id", m.db.id);
      })
    );
    for (const r of results) if (r.error) throw new Error(`link update failed: ${r.error.message}`);
  }

  // ---- apply: add what the bank has and we don't
  const newRows = missing.map((m) => {
    const b = bankById.get(m.id)!;
    return {
      ...buildImportRow(b.t, {
        institution: b.acct.institution.name,
        owner: ownerMap.get(b.acct.id)!,
        accountId: dbAccountByRb.get(b.acct.id)!,
        merchantRules,
        ourAccountDigits,
      }),
      review_reason: REASONS.missing,
    };
  });
  for (let i = 0; i < newRows.length; i += 200) {
    const chunk = newRows.slice(i, i + 200);
    let { error } = await supabase.from("transactions").insert(chunk);
    if (error && isMissingColumn(error)) ({ error } = await supabase.from("transactions").insert(chunk.map(stripDetailColumns)));
    if (error) throw new Error(`insert failed: ${error.message}`);
  }

  // ---- apply: flag suspect rows for review
  const flag = async (ids: string[], reason: string) => {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase
        .from("transactions")
        .update({ status: "pending_review", review_reason: reason })
        .in("id", ids.slice(i, i + 200));
      if (error) throw new Error(`flag update failed: ${error.message}`);
    }
  };
  await flag(orphans.filter((r) => !dupIds.has(r.id)).map((r) => r.id), REASONS.orphan);
  await flag([...dupIds], REASONS.duplicate);

  return result;
}
