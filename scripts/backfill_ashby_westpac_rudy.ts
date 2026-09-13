/**
 * One-off backfill fixing three real double-counting bugs found by walking
 * through the numbers with the user:
 *
 * 1. Ashby investment-loan principal transfers were tagged type=debt (an
 *    expense) on top of the loan's interest, which is *also* surfaced as an
 *    expense elsewhere — double-counting the same loan. Moves them to
 *    category=Investment (alongside the interest), type=transfers.
 * 2. Westpac Flexi Loan buffer-account transfers were tagged type=debt for
 *    the same reason (the account's real interest/fees are captured
 *    separately and already correct) — moves them to type=transfers. Also
 *    classifies the account's own inbound/outbound legs, which were sitting
 *    uncategorised as "Financial".
 * 3. The ~$1,300/month transfers to Rudy are real recurring family
 *    assistance, not a debt repayment — moves the plain "RUDY <code>" rows
 *    (no other confirmed category is present) to a real category="Family
 *    Assistance" so it's tracked as a genuine expense.
 *
 * Usage: npx tsx --env-file=.env.local scripts/backfill_ashby_westpac_rudy.ts
 */
import { createServiceClient } from "../lib/supabase/server";

const WESTPAC_FLEXI_LOAN_ACCOUNT_ID = "4a25a250-1b14-4e45-a27b-98cba148cb48";

async function main() {
  const supabase = createServiceClient();

  // Ensure the new category exists (FK: transactions.category -> categories.name).
  const { error: catError } = await supabase
    .from("categories")
    .upsert({ name: "Family Assistance", type: "bills_fixed" }, { onConflict: "name" });
  if (catError) throw catError;

  // 1. Ashby loan principal transfers -> Investment/Ashby Loan/transfers.
  // Covers both the original Money Movement/Ashby Loan rows and the ones
  // already manually moved to Investment/Ashby (different sub_category spelling).
  const { data: ashbyRows, error: ashbyErr } = await supabase
    .from("transactions")
    .select("id")
    .or("and(category.eq.Money Movement,sub_category.eq.Ashby Loan),and(category.eq.Investment,sub_category.eq.Ashby)");
  if (ashbyErr) throw ashbyErr;
  for (const r of ashbyRows ?? []) {
    const { error } = await supabase
      .from("transactions")
      .update({ category: "Investment", sub_category: "Ashby Loan", type: "transfers" })
      .eq("id", r.id);
    if (error) throw error;
  }

  // 2a. Westpac Flexi Loan buffer repayments -> transfers (keep category/sub_category).
  const { data: wpRepay, error: wpErr } = await supabase
    .from("transactions")
    .select("id")
    .eq("category", "Money Movement")
    .eq("sub_category", "Westpac repayment");
  if (wpErr) throw wpErr;
  for (const r of wpRepay ?? []) {
    const { error } = await supabase.from("transactions").update({ type: "transfers" }).eq("id", r.id);
    if (error) throw error;
  }

  // 2b. The Westpac Flexi Loan account's own buffer legs (currently sitting
  // uncategorised as "Financial") -> Money Movement/Internal transfer.
  const { data: wpBuffer, error: wpBufferErr } = await supabase
    .from("transactions")
    .select("id, detail")
    .eq("account_id", WESTPAC_FLEXI_LOAN_ACCOUNT_ID)
    .eq("category", "Financial");
  if (wpBufferErr) throw wpBufferErr;
  for (const r of wpBuffer ?? []) {
    const { error } = await supabase
      .from("transactions")
      .update({ category: "Money Movement", sub_category: "Internal transfer", type: "transfers" })
      .eq("id", r.id);
    if (error) throw error;
  }

  // 3. Rudy: only the plain "RUDY <code>" rows still sitting in the old
  // Money Movement/Rudy/debt bucket — not the 40+ other Rudy-related rows the
  // user already sorted elsewhere (gifts, reimbursements, etc.), and not the
  // one inbound "Fast Transfer From RUDOLPH THOMAS Rent" credit.
  const { data: rudyRows, error: rudyErr } = await supabase
    .from("transactions")
    .select("id, detail, amount")
    .eq("category", "Money Movement")
    .eq("sub_category", "Rudy");
  if (rudyErr) throw rudyErr;
  let rudyUpdated = 0;
  for (const r of rudyRows ?? []) {
    const isPlainCode = /^RUDY [A-Z0-9]+$/i.test((r.detail ?? "").trim());
    if (!isPlainCode || Number(r.amount) > 0) continue;
    const { error } = await supabase
      .from("transactions")
      .update({ category: "Family Assistance", sub_category: "Rudy", type: "bills_fixed" })
      .eq("id", r.id);
    if (error) throw error;
    rudyUpdated++;
  }

  console.log(`Ashby loan transfers moved to Investment/transfers: ${ashbyRows?.length ?? 0}`);
  console.log(`Westpac repayments moved to transfers: ${wpRepay?.length ?? 0}`);
  console.log(`Westpac buffer legs classified as Money Movement: ${wpBuffer?.length ?? 0}`);
  console.log(`Rudy transfers moved to Family Assistance: ${rudyUpdated} (of ${rudyRows?.length ?? 0} in the old bucket)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
