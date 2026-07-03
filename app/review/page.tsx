import ReviewQueue from "@/components/ReviewQueue";
import { PageHeader, EmptyState } from "@/components/ui";
import { fetchAllTransactions } from "@/lib/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { rows } = await fetchAllTransactions({ status: "pending_review" });

  return (
    <div className="space-y-6">
      <PageHeader title="Review" subtitle="Approve auto-categorised imports" />

      {rows.length === 0 ? (
        <EmptyState>
          <div>
            Nothing to review.{" "}
            <Link href="/import" className="text-indigo-600 hover:underline">
              Import a CSV
            </Link>{" "}
            to get started.
          </div>
        </EmptyState>
      ) : (
        <ReviewQueue rows={rows} />
      )}
    </div>
  );
}
