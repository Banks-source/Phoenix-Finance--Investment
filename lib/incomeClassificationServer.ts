import { createServiceClient } from "@/lib/supabase/server";
import { resolveIncomeSubCategory, Owner } from "@/lib/incomeClassification";

export interface IncomeClassificationResult {
  updated: number;
  reclassifiedFromMoneyMovement: number;
}

/**
 * Collapses every "Income" transaction's sub_category onto the canonical
 * 5-bucket taxonomy (Lloyd Salary / Milani Salary / Rent / Taxes / Other
 * Income), replacing whatever ad-hoc label (Dividend, Refund, Lloyd, Milani,
 * Interest, ...) was there before. Also fixes ATO refunds that were sitting
 * under "Money Movement" — a tax refund is income, not a transfer.
 */
export async function classifyAllIncomeSubCategories(): Promise<IncomeClassificationResult> {
  const supabase = createServiceClient();

  // Money Movement rows that are actually ATO refunds — move them to Income.
  const { data: misfiled } = await supabase
    .from("transactions")
    .select("id")
    .eq("category", "Money Movement")
    .ilike("detail", "%ATO REFUND%");
  for (const r of misfiled ?? []) {
    const { error } = await supabase
      .from("transactions")
      .update({ category: "Income", type: "income", sub_category: "Taxes" })
      .eq("id", r.id);
    if (error) throw error;
  }

  const PAGE = 1000;
  let updated = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, detail, owner")
      .eq("category", "Income")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];

    const updates = rows.map((r) => ({
      id: r.id,
      sub_category: resolveIncomeSubCategory(r.detail, r.owner as Owner),
    }));
    const BATCH = 200;
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((u) => supabase.from("transactions").update({ sub_category: u.sub_category }).eq("id", u.id))
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      updated += batch.length;
    }

    if (rows.length < PAGE) break;
  }

  return { updated, reclassifiedFromMoneyMovement: misfiled?.length ?? 0 };
}
