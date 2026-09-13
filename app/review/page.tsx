import ReviewQueue from "@/components/ReviewQueue";
import { PageHeader, EmptyState } from "@/components/ui";
import { fetchAllTransactions } from "@/lib/queries";
import { fetchAllSubCategoryNames } from "@/lib/subCategoriesTable";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const [{ rows }, allSubCategories] = await Promise.all([
    fetchAllTransactions({ status: "pending_review" }),
    fetchAllSubCategoryNames(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Review" subtitle="Approve auto-categorised imports" />

      {rows.length === 0 ? (
        <EmptyState>Nothing to review — new Redbark transactions will show up here automatically.</EmptyState>
      ) : (
        <ReviewQueue rows={rows} allSubCategories={allSubCategories} />
      )}
    </div>
  );
}
