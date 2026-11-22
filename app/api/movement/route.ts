import { NextRequest, NextResponse } from "next/server";
import { runMovementEngine } from "@/lib/movementRun";

export const maxDuration = 120;

// Behind the normal login. { apply?: boolean, since?: "YYYY-MM-DD" } — a dry run unless apply is true.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { apply?: boolean; since?: string };
  const since = body.since && /^\d{4}-\d{2}-\d{2}$/.test(body.since) ? body.since : `${new Date().getFullYear()}-01-01`;
  try {
    return NextResponse.json(await runMovementEngine({ since, apply: body.apply === true }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
