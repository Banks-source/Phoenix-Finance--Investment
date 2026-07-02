import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { CATEGORY_TYPE } from "@/lib/taxonomy";

// Approves a pending_review transaction. Runs server-side with the service
// role key — the browser never holds write access to the transactions
// table (RLS is enabled with no anon/authenticated policies).
export async function POST(req: NextRequest) {
  const { id, category } = (await req.json()) as { id: string; category: string };
  if (!id || !category) {
    return NextResponse.json({ error: "id and category are required" }, { status: 400 });
  }

  const type = CATEGORY_TYPE[category] ?? "needs_categorisation";
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("transactions")
    .update({ category, type, status: "approved" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
