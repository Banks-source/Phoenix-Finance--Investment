import { createServiceClient } from "@/lib/supabase/server";
import { classifyMoneyMovement, extractAccountDigits } from "@/lib/transferClassification";

/** All 4+ digit fragments from every known account's label/masked number — "our own accounts". */
export async function fetchOurAccountDigits(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("accounts").select("account_label, account_number_masked");
  const digits = new Set<string>();
  for (const a of data ?? []) {
    for (const d of extractAccountDigits(a.account_label, a.account_number_masked)) digits.add(d);
  }
  return [...digits];
}

export interface TransferClassificationResult {
  internal: number;
  external: number;
  unclassified: number;
}

/**
 * Backfills sub_category on existing "Money Movement" rows that don't have
 * one yet. Only writes rows classifyMoneyMovement can actually determine —
 * genuinely ambiguous rows are left untouched for manual review.
 */
export async function classifyUnlabeledMoneyMovement(): Promise<TransferClassificationResult> {
  const supabase = createServiceClient();
  const ourDigits = await fetchOurAccountDigits();

  // PostgREST caps a response at 1000 rows by default, so page through
  // explicitly — the "Money Movement" bucket has thousands of rows.
  const rows: { id: string; detail: string | null }[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, detail")
      .eq("category", "Money Movement")
      .is("sub_category", null)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  let internal = 0;
  let external = 0;
  let unclassified = 0;
  const updates: { id: string; sub_category: string }[] = [];

  for (const r of rows ?? []) {
    const direction = classifyMoneyMovement(r.detail, ourDigits);
    if (direction === "Internal transfer") internal++;
    else if (direction === "External transfer") external++;
    else {
      unclassified++;
      continue;
    }
    updates.push({ id: r.id, sub_category: direction });
  }

  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((u) => supabase.from("transactions").update({ sub_category: u.sub_category }).eq("id", u.id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  return { internal, external, unclassified };
}
