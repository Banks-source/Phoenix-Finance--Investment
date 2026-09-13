/**
 * One-off backfill: classifies existing "Money Movement" transactions as
 * Internal transfer (between our own accounts) or External transfer (money
 * that actually left the household), based on the bank description. Rows
 * that can't be determined with confidence are left alone for manual review.
 *
 * Usage: npx tsx --env-file=.env.local scripts/backfill_transfer_classification.ts
 */
import { classifyUnlabeledMoneyMovement } from "../lib/transferClassificationServer";

async function main() {
  const result = await classifyUnlabeledMoneyMovement();
  console.log(`Internal transfer: ${result.internal}`);
  console.log(`External transfer: ${result.external}`);
  console.log(`Still unclassified (needs manual review): ${result.unclassified}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
