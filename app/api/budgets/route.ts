import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/taxonomy";
import { setCategoryBudget } from "@/lib/budgets";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { category?: string; monthly_target?: number };
  if (!body.category || !CATEGORIES.some((c) => c.name === body.category)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  if (typeof body.monthly_target !== "number") {
    return NextResponse.json({ error: "monthly_target is required" }, { status: 400 });
  }

  const result = await setCategoryBudget(body.category, body.monthly_target);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
