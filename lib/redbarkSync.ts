import { createServiceClient } from "@/lib/supabase/server";
import { listConnections, listAccounts, listTransactions, RedbarkAccount } from "@/lib/redbark";
import { categoriseSync, MerchantRule } from "@/lib/categorise";

export type RedbarkSyncResult = {
  imported: number;
  skippedDuplicates: number;
  unmappedAccounts: { id: string; name: string; institution: string }[];
  perAccount: { accountId: string; name: string; imported: number }[];
};

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

  const { data: existing } = await supabase.from("transactions").select("date, amount, detail, owner");
  const seen = new Set((existing ?? []).map((e) => `${e.date}|${e.amount}|${e.detail}|${e.owner}`));

  const connections = await listConnections();
  const bankingAccounts: RedbarkAccount[] = [];
  for (const conn of connections) {
    if (conn.status !== "active" || conn.category !== "banking") continue;
    bankingAccounts.push(...(await listAccounts(conn.id)));
  }

  const result: RedbarkSyncResult = { imported: 0, skippedDuplicates: 0, unmappedAccounts: [], perAccount: [] };

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
      if (error) throw error;
      accountId = created.id;
    }

    const txns = await listTransactions(acct.id, { from, includePending: false });
    const toInsert: any[] = [];
    for (const t of txns) {
      const signedAmount = t.direction === "debit" ? -Math.abs(t.amount.amount) : Math.abs(t.amount.amount);
      const amount = signedAmount / 100; // Redbark amounts are in minor units (cents)
      const key = `${t.date}|${amount}|${t.description}|${owner}`;
      if (seen.has(key)) {
        result.skippedDuplicates++;
        continue;
      }
      seen.add(key);
      const s = categoriseSync(t.merchant_name ?? t.description, t.description, merchantRules, t.provider_category);
      toInsert.push({
        date: t.date,
        amount,
        account_id: accountId,
        owner,
        transaction_type: t.direction,
        detail: t.description,
        merchant: t.merchant_name ?? t.description,
        category: s.category,
        sub_category: s.sub_category,
        type: s.type,
        status: "pending_review", // always — no silent auto-categorisation
        confidence: s.confidence,
        source: "bank_import",
      });
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from("transactions").insert(toInsert);
      if (error) throw error;
    }

    await supabase.from("accounts").update({ redbark_last_synced_at: new Date().toISOString() }).eq("id", accountId);

    result.imported += toInsert.length;
    result.perAccount.push({ accountId: acct.id, name: acct.name, imported: toInsert.length });
  }

  return result;
}
