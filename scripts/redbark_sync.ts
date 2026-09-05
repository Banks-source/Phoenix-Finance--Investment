/**
 * Manual/local run of the Redbark bank-feed sync (same logic the daily
 * Vercel Cron job at /api/redbark/sync runs).
 *
 * Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *        REDBARK_API_KEY=... REDBARK_API_VERSION=... npm run redbark:sync
 */
import { runRedbarkSync } from "../lib/redbarkSync";

async function main() {
  const result = await runRedbarkSync();
  console.log(`imported ${result.imported} transaction(s), skipped ${result.skippedDuplicates} duplicate(s)`);
  for (const a of result.perAccount) {
    console.log(`  ${a.name} (${a.accountId}): ${a.imported} imported`);
  }
  if (result.unmappedAccounts.length > 0) {
    console.log(`\n${result.unmappedAccounts.length} account(s) skipped — no owner mapping:`);
    for (const a of result.unmappedAccounts) {
      console.log(`  ${a.id}  ${a.institution} — ${a.name}`);
    }
    console.log(`\nRun 'npm run redbark:accounts' to see all connected accounts, then have an owner`);
    console.log(`row added to redbark_account_owners for each before it will sync.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
