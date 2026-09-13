/**
 * Moves every approved 2026 transaction back to pending_review so it can be
 * re-reviewed from scratch. Only flips `status` — category/sub_category/type
 * are left as-is, so the Review queue shows the current best guess as a
 * starting point rather than wiping it.
 *
 * Usage: npx tsx --env-file=.env.local scripts/reset_2026_to_review.ts
 */
import { createServiceClient } from "../lib/supabase/server";

async function main() {
  const supabase = createServiceClient();

  // A single filtered UPDATE — no need to select ids first (that hit
  // PostgREST's 1000-row select cap, and .in() with 1000 ids hit a request
  // size limit). Postgres applies this to every matching row in one go.
  const { error } = await supabase
    .from("transactions")
    .update({ status: "pending_review" })
    .gte("date", "2026-01-01")
    .lte("date", "2026-12-31")
    .eq("status", "approved");
  if (error) throw error;

  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .gte("date", "2026-01-01")
    .lte("date", "2026-12-31")
    .eq("status", "approved");

  console.log(`Done. Remaining approved 2026 transactions: ${count} (should be 0).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
