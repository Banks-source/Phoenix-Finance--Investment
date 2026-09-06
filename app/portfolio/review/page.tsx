import QuarterlyReviewFlow from "@/components/QuarterlyReviewFlow";
import { PageHeader, EmptyState } from "@/components/ui";
import { fetchReviewHistory } from "@/lib/quarterlyReviewServer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function QuarterlyReviewPage() {
  const history = await fetchReviewHistory();
  const completed = history.filter((r) => r.completedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quarterly review"
        subtitle="Six steps, ≤30 minutes"
        actions={
          <Link href="/portfolio" className="btn-ghost">
            <ArrowLeft size={15} /> Portfolio
          </Link>
        }
      />

      <QuarterlyReviewFlow />

      <div className="card p-5">
        <h2 className="mb-2 text-sm font-semibold">Past reviews</h2>
        {completed.length === 0 ? (
          <EmptyState>No completed reviews yet.</EmptyState>
        ) : (
          <div className="divide-y divide-gray-100">
            {completed.map((r) => (
              <details key={r.id} className="py-2 text-sm">
                <summary className="cursor-pointer">
                  {r.startedAt.slice(0, 10)} — {r.elapsedSeconds != null ? `${Math.round(r.elapsedSeconds / 60)} min` : "—"}
                </summary>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">{r.markdownLog}</pre>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
