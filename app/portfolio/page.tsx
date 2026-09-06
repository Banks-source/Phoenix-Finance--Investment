import AllocationDashboard from "@/components/AllocationDashboard";
import HardRulesPanel from "@/components/HardRulesPanel";
import { PageHeader } from "@/components/ui";
import { fetchAllocationSummary } from "@/lib/allocation";
import { evaluateAllHardRules } from "@/lib/hardRules";
import Link from "next/link";
import { ClipboardCheck, BookOpen, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const [summary, hardRules] = await Promise.all([fetchAllocationSummary(), evaluateAllHardRules()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        subtitle="Thesis sleeve allocation, converted to AUD, latest sync"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/portfolio/thesis" className="btn-ghost">
              <BookOpen size={15} /> Thesis
            </Link>
            <Link href="/portfolio/projections" className="btn-ghost">
              <TrendingUp size={15} /> Projections
            </Link>
            <Link href="/portfolio/review" className="btn-primary">
              <ClipboardCheck size={15} /> Quarterly review
            </Link>
          </div>
        }
      />
      <HardRulesPanel rules={hardRules} />
      <AllocationDashboard summary={summary} />
    </div>
  );
}
