/**
 * One-off backfill: collapses every Income transaction's sub_category onto
 * the canonical taxonomy (Lloyd Salary / Milani Salary / Rent / Taxes / Other
 * Income), replacing ad-hoc legacy labels. Also moves ATO refunds that were
 * sitting under "Money Movement" into Income.
 *
 * Usage: npx tsx --env-file=.env.local scripts/backfill_income_subcategories.ts
 */
import { classifyAllIncomeSubCategories } from "../lib/incomeClassificationServer";

async function main() {
  const result = await classifyAllIncomeSubCategories();
  console.log(`Updated sub_category on ${result.updated} Income transaction(s)`);
  console.log(`Moved ${result.reclassifiedFromMoneyMovement} ATO refund(s) from Money Movement to Income`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
