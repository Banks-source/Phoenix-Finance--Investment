import { NextRequest, NextResponse } from "next/server";
import { applyReviewEdit, EditRequest } from "@/lib/reviewEdit";

// Transaction edit endpoint (service-role, server-only). Every edit view uses it;
// the logic lives in lib/reviewEdit.ts so the MCP server shares it.
export async function POST(req: NextRequest) {
  const result = await applyReviewEdit((await req.json()) as EditRequest);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const { ok, ...rest } = result;
  return NextResponse.json({ ok, ...rest });
}
