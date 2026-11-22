import { PageHeader } from "@/components/ui";
import MemoryList, { MemoryRule } from "@/components/MemoryList";
import { createServiceClient } from "@/lib/supabase/server";
import { pageAll } from "@/lib/payeeMemory";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const rules = await pageAll<MemoryRule & { updated_at?: string }>((s) => s.from("merchant_rules").select("*").order("last_used", { ascending: false }), createServiceClient());
  return (
    <div className="space-y-4">
      <PageHeader
        title="Categorisation memory"
        subtitle={`${rules.length.toLocaleString()} payees remembered · your own edits always win, then the built-in rules, then what was inferred`}
      />
      <MemoryList rules={rules} />
    </div>
  );
}
