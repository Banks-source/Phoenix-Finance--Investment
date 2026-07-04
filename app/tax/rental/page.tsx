import Link from "next/link";
import RentalSchedule from "@/components/RentalSchedule";
import { PageHeader } from "@/components/ui";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-static";

export default function RentalPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rental schedule"
        subtitle="Investment properties · net rent history"
        actions={
          <Link href="/tax" className="btn-ghost">
            <ArrowLeft size={15} /> Back to Tax
          </Link>
        }
      />
      <RentalSchedule />
    </div>
  );
}
