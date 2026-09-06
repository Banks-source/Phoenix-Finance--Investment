import ThesisEditor from "@/components/ThesisEditor";
import { PageHeader } from "@/components/ui";
import { fetchThesisData } from "@/lib/thesisServer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ThesisPage() {
  const data = await fetchThesisData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thesis"
        subtitle="Your beliefs, bands, and rule thresholds — all editable"
        actions={
          <Link href="/portfolio" className="btn-ghost">
            <ArrowLeft size={15} /> Portfolio
          </Link>
        }
      />
      <ThesisEditor data={data} />
    </div>
  );
}
