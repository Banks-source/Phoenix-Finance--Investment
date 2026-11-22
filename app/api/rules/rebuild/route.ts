import { NextResponse } from "next/server";
import { rebuildMemory } from "@/lib/payeeMemory";

export const maxDuration = 60;

// Re-keys the old raw-text rules onto payee keys and seeds new ones from your
// approved history. Safe to run repeatedly. Behind the normal login.
export async function POST() {
  try {
    return NextResponse.json({ ok: true, ...(await rebuildMemory()) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
