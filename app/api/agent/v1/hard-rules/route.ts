import { NextResponse } from "next/server";
import { evaluateAllHardRules, HARD_RULES_VERSION } from "@/lib/hardRules";

export const dynamic = "force-dynamic";

export async function GET() {
  const rules = await evaluateAllHardRules();
  return NextResponse.json({
    as_of: new Date().toISOString(),
    version: HARD_RULES_VERSION,
    rules: rules.map((r) => ({ rule: r.rule, name: r.name, status: r.status, reason: r.reason })),
  });
}
