import ProjectionsEditor from "@/components/ProjectionsEditor";
import { PageHeader } from "@/components/ui";
import { fetchProjectionData } from "@/lib/projectionsServer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProjectionsPage() {
  const data = await fetchProjectionData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projections"
        subtitle="Forward-looking value at 65 / 75 / 85 — every input is yours to change"
        actions={
          <Link href="/portfolio" className="btn-ghost">
            <ArrowLeft size={15} /> Portfolio
          </Link>
        }
      />
      <ProjectionsEditor data={data} />
    </div>
  );
}
