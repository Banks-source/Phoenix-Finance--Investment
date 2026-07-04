/**
 * One-off: seed Lloyd's FY2026 manually-itemised deduction lines into
 * claim_estimates. These are stored under composite category keys
 * `<parent> :: <label>` (the same convention the ClaimsHistory UI uses), so they
 * appear as editable/removable lines under "Home office & tech".
 *
 * Usage: set -a; source .env.local; set +a; npx tsx scripts/seed-claim-lines.ts
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PERSON = "lloyd";
const FY = 2026;
const PARENT = "Home office & tech";

const LINES: { label: string; amount: number }[] = [
  { label: "Headphones JB Hi Fi", amount: 205 },
  { label: "Headphone Myer", amount: 170.1 },
  { label: "iPad", amount: 699 },
  { label: "Watch", amount: 729 },
];

async function main() {
  const rows = LINES.map((l) => ({
    person: PERSON,
    fy: FY,
    category: `${PARENT} :: ${l.label}`,
    amount: l.amount,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("claim_estimates").upsert(rows);
  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
  console.log(`Seeded ${rows.length} line item(s) under "${PARENT}" for ${PERSON} FY${FY}:`);
  for (const l of LINES) console.log(`  • ${l.label} — $${l.amount.toFixed(2)}`);
}

main();
