/**
 * Re-derives sub_category on every transaction currently in Review (any
 * status=pending_review row, whether it was already set or blank) using the
 * curated sub_categories rule engine — the same scheme seeded into
 * supabase/migrations/0013_sub_categories.sql. `category` is never touched.
 *
 * - Money Movement uses the account/name-based internal/external classifier
 *   plus the remaining buckets (Cash Withdrawal, Card payment, ZipMoney,
 *   Centrelink, Needs review).
 * - Every other category in the consolidation scheme uses keyword rules,
 *   falling back to that category's "Other" (or "Uncategorised" for
 *   Financial, "Restaurants & Takeaway" for Dining Out).
 * - Income and Family Assistance are skipped — already on their own
 *   canonical, small sub-category schemes from earlier work.
 *
 * Usage: npx tsx --env-file=.env.local scripts/consolidate_review_subcategories.ts
 */
import { createServiceClient } from "../lib/supabase/server";
import { deriveMoneyMovementSubCategory, extractAccountDigits } from "../lib/transferClassification";
import { deriveConsolidatedSubCategory } from "../lib/subCategoryConsolidation";

const SKIP_CATEGORIES = new Set(["Income", "Family Assistance"]);

async function main() {
  const supabase = createServiceClient();

  const { data: accountRows } = await supabase.from("accounts").select("account_label, account_number_masked");
  const ourAccountDigits = extractAccountDigits(...(accountRows ?? []).flatMap((a) => [a.account_label, a.account_number_masked]));

  const PAGE = 1000;
  const byCategory: Record<string, number> = {};
  const byNewSub: Record<string, number> = {};
  let updated = 0;
  let skippedCategory = 0;
  let noRule = 0;

  for (let from = 0; ; from += PAGE) {
    const { data: rows, error } = await supabase
      .from("transactions")
      .select("id, category, sub_category, merchant, detail")
      .eq("status", "pending_review")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    for (const r of rows) {
      const category = r.category ?? "";
      if (SKIP_CATEGORIES.has(category)) {
        skippedCategory++;
        continue;
      }

      const newSub =
        category === "Money Movement"
          ? deriveMoneyMovementSubCategory(r.detail, r.merchant, ourAccountDigits)
          : deriveConsolidatedSubCategory(category, r.merchant, r.detail);

      if (newSub === null) {
        // Category isn't part of the scheme at all (shouldn't happen given
        // the skip-list above, but stay conservative rather than guessing).
        noRule++;
        continue;
      }

      if (newSub !== r.sub_category) {
        const { error: updateError } = await supabase.from("transactions").update({ sub_category: newSub }).eq("id", r.id);
        if (updateError) throw updateError;
      }
      updated++;
      byCategory[category] = (byCategory[category] ?? 0) + 1;
      byNewSub[`${category} / ${newSub}`] = (byNewSub[`${category} / ${newSub}`] ?? 0) + 1;
    }

    if (rows.length < PAGE) break;
  }

  console.log(`Processed ${updated} transaction(s) across ${Object.keys(byCategory).length} categories.`);
  console.log(`Skipped ${skippedCategory} (Income/Family Assistance — already on their own scheme).`);
  if (noRule) console.log(`${noRule} had no applicable rule at all (unexpected).`);
  console.log("\nBreakdown:");
  for (const [k, v] of Object.entries(byNewSub).sort((a, b) => b[1] - a[1])) console.log(" ", k, v);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
