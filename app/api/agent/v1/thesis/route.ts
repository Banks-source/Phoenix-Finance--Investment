import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { THESIS_SLEEVES, SLEEVE_LABELS } from "@/lib/sleeves";
import { HARD_RULE_DEFINITIONS, HARD_RULES_VERSION } from "@/lib/hardRules";

export const dynamic = "force-dynamic";

// Current beliefs, bands and rules as structured data — the thesis's shape,
// not its live evaluation (see /allocation and /hard-rules for that).
export async function GET() {
  const supabase = createServiceClient();
  const { data: targets } = await supabase.from("sleeve_targets").select("sleeve, min_pct, max_pct");
  const targetBySleeve = new Map((targets ?? []).map((t) => [t.sleeve, t]));

  return NextResponse.json({
    as_of: new Date().toISOString(),
    sleeves: THESIS_SLEEVES.map((sleeve) => {
      const t = targetBySleeve.get(sleeve);
      return {
        sleeve,
        label: SLEEVE_LABELS[sleeve],
        min_pct: t ? Number(t.min_pct) : null,
        max_pct: t ? Number(t.max_pct) : null,
      };
    }),
    hard_rules_version: HARD_RULES_VERSION,
    hard_rules: HARD_RULE_DEFINITIONS,
  });
}
