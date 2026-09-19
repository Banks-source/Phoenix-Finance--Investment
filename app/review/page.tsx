import ReviewQueue from "@/components/ReviewQueue";
import { PageHeader, EmptyState } from "@/components/ui";
import { fetchAllTransactions } from "@/lib/queries";
import { fetchAllSubCategoryNames } from "@/lib/subCategoriesTable";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveFromTo, AccountRef } from "@/lib/transferAccounts";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const [{ rows }, allSubCategories, { data: accountRows }] = await Promise.all([
    fetchAllTransactions({ status: "pending_review" }),
    fetchAllSubCategoryNames(),
    createServiceClient().from("accounts").select("id, institution, account_label, account_number_masked"),
  ]);
  const accounts = (accountRows ?? []) as AccountRef[];

  // The two legs of a transfer share a bank reference — pair them so the
  // other account is known even when the description doesn't name it.
  const byRef = new Map<string, { account_id: string }[]>();
  for (const r of rows) {
    if (!r.reference || !r.account_id) continue;
    byRef.set(r.reference, [...(byRef.get(r.reference) ?? []), { account_id: r.account_id }]);
  }
  const flows: Record<string, { from: string | null; to: string | null }> = {};
  for (const r of rows) {
    const paired = r.reference ? byRef.get(r.reference)?.find((p) => p.account_id !== r.account_id)?.account_id : null;
    const { from, to } = resolveFromTo(r, accounts, paired);
    flows[r.id] = { from, to };
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Review" subtitle="Approve auto-categorised imports" />

      {rows.length === 0 ? (
        <EmptyState>Nothing to review — new Redbark transactions will show up here automatically.</EmptyState>
      ) : (
        <ReviewQueue rows={rows} allSubCategories={allSubCategories} flows={flows} />
      )}
    </div>
  );
}
