/**
 * One-time historical backfill. Loads supabase/seed/transactions_backfill.csv
 * (16,586 rows, generated from the four Budget workbook "Transactions"
 * sheets — see PRD.md §6) into the transactions table, creating accounts
 * as needed.
 *
 * Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run backfill
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const csvPath = path.join(__dirname, "../supabase/seed/transactions_backfill.csv");
  const csv = fs.readFileSync(csvPath, "utf-8");
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });

  const accountCache = new Map<string, string>();

  async function getAccountId(institution: string, label: string, owner: string) {
    const key = `${institution}:${label}`;
    if (accountCache.has(key)) return accountCache.get(key)!;
    const { data: existing } = await supabase
      .from("accounts")
      .select("id")
      .eq("institution", institution)
      .eq("account_label", label)
      .maybeSingle();
    if (existing) {
      accountCache.set(key, existing.id);
      return existing.id;
    }
    const { data: created, error } = await supabase
      .from("accounts")
      .insert({ institution, account_label: label, owner })
      .select("id")
      .single();
    if (error) throw error;
    accountCache.set(key, created.id);
    return created.id;
  }

  const batch: any[] = [];
  let count = 0;

  for (const row of data as Record<string, string>[]) {
    if (!row.date) continue;
    const accountId = await getAccountId(row.institution, row.account_raw, row.owner);
    batch.push({
      date: row.date,
      amount: parseFloat(row.amount || "0"),
      account_id: accountId,
      owner: row.owner,
      transaction_type: row.transaction_type,
      detail: row.detail,
      merchant: row.merchant,
      category: row.category,
      sub_category: row.sub_category || null,
      type: row.type,
      status: row.type === "needs_categorisation" ? "pending_review" : "approved",
      source: "historical_import",
    });

    if (batch.length >= 500) {
      const { error } = await supabase.from("transactions").insert(batch);
      if (error) throw error;
      count += batch.length;
      console.log(`inserted ${count}`);
      batch.length = 0;
    }
  }
  if (batch.length) {
    const { error } = await supabase.from("transactions").insert(batch);
    if (error) throw error;
    count += batch.length;
  }
  console.log(`done — ${count} transactions backfilled`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
