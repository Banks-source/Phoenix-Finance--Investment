import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Editable kill-criteria master list (#6). Editing/adding here never
// rewrites past quarterly reviews — those snapshot the text at the time.
//   - Update text:  { id, text }
//   - Create:       { text, sort_order }
//   - Delete:       { id, delete: true }
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { id?: string; text?: string; sort_order?: number; delete?: boolean };
  const supabase = createServiceClient();

  if (body.delete) {
    if (!body.id) return NextResponse.json({ error: "id required to delete" }, { status: 400 });
    const { error } = await supabase.from("kill_criteria_templates").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!body.text) return NextResponse.json({ error: "text required" }, { status: 400 });

  if (body.id) {
    const { error } = await supabase.from("kill_criteria_templates").update({ text: body.text, is_example: false }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("kill_criteria_templates")
    .insert({ text: body.text, sort_order: body.sort_order ?? 999, is_example: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
