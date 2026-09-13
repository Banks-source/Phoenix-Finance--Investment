import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/taxonomy";
import { addSubCategory, deleteSubCategory } from "@/lib/subCategoriesTable";

// The sub-categories rule engine table: adding is unrestricted; deleting is
// only ever allowed when no transaction still references the sub-category
// (enforced again server-side in deleteSubCategory, not just hidden in the UI).
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { category?: string; name?: string };
  if (!body.category || !CATEGORIES.some((c) => c.name === body.category)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const result = await addSubCategory(body.category, body.name);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { category?: string; name?: string };
  if (!body.category || !body.name) {
    return NextResponse.json({ error: "category and name are required" }, { status: 400 });
  }
  const result = await deleteSubCategory(body.category, body.name);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
