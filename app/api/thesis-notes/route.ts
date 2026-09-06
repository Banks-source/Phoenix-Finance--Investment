import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { notes?: string };
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("thesis_notes")
    .upsert({ id: "main", notes: body.notes ?? null, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
