/**
 * Prefills a sensible default sub-category (derived from merchant name) on
 * every transaction currently in Review that doesn't have one yet — so
 * there's something to confirm or edit instead of a blank field. Only
 * touches status=pending_review rows with sub_category IS NULL; anything
 * already sub-categorised (Income, Money Movement, Family Assistance, or a
 * value you've already set) is left untouched.
 *
 * Usage: npx tsx --env-file=.env.local scripts/prefill_review_subcategories.ts
 */
import { createServiceClient } from "../lib/supabase/server";
import { deriveDefaultSubCategory } from "../lib/subCategoryDefaults";

async function main() {
  const supabase = createServiceClient();

  let updated = 0;
  let skippedEmpty = 0;
  const PAGE = 1000;
  for (;;) {
    // No offset: a row we successfully update drops out of this same
    // IS NULL filter, so re-running the identical query naturally advances.
    // Rows we skip (nothing to derive) stay matched — tracked per page below
    // so the loop terminates instead of refetching the same skips forever.
    const { data: rows, error } = await supabase
      .from("transactions")
      .select("id, merchant, detail")
      .eq("status", "pending_review")
      .is("sub_category", null)
      .limit(PAGE);
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    let updatedThisPage = 0;
    for (const r of rows) {
      const sub = deriveDefaultSubCategory(r.merchant, r.detail);
      if (!sub) {
        skippedEmpty++;
        continue;
      }
      const { error: updateError } = await supabase.from("transactions").update({ sub_category: sub }).eq("id", r.id);
      if (updateError) throw updateError;
      updated++;
      updatedThisPage++;
    }

    if (updatedThisPage === 0) break; // this whole page was unfixable — stop instead of looping forever
  }

  console.log(`Prefilled sub_category on ${updated} transaction(s).`);
  console.log(`Left ${skippedEmpty} with no merchant/detail to derive anything from.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
