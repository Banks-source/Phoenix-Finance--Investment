import AllocationDashboard from "@/components/AllocationDashboard";
import { PageHeader } from "@/components/ui";
import { fetchAllocationSummary } from "@/lib/allocation";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const summary = await fetchAllocationSummary();

  return (
    <div className="space-y-6">
      <PageHeader title="Portfolio" subtitle="Thesis sleeve allocation, converted to AUD, latest sync" />
      <AllocationDashboard summary={summary} />
    </div>
  );
}
