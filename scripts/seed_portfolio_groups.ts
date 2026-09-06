/**
 * One-time seed: maps each known Kubera portfolio to personal/retirement,
 * and flags the biofuels holding as legacy (SOLUTION_DESIGN.md §9.2 already
 * calls this one out by name). Safe to re-run — upserts on conflict.
 *
 * Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:portfolio-groups
 */
import { createServiceClient } from "../lib/supabase/server";

async function main() {
  const supabase = createServiceClient();

  const { data: snapshots, error } = await supabase
    .from("portfolio_snapshots")
    .select("kubera_portfolio_id, portfolio_name, assets")
    .order("synced_at", { ascending: false });
  if (error) throw error;

  const seenPortfolios = new Map<string, string>();
  for (const s of snapshots ?? []) {
    if (!seenPortfolios.has(s.kubera_portfolio_id)) seenPortfolios.set(s.kubera_portfolio_id, s.portfolio_name);
  }

  const groups = [...seenPortfolios.entries()].map(([kubera_portfolio_id, portfolio_name]) => ({
    kubera_portfolio_id,
    portfolio_name,
    group_name: portfolio_name === "SMSF" ? "retirement" : "personal",
    note: "seeded by scripts/seed_portfolio_groups.ts",
  }));

  if (groups.length === 0) {
    console.log("No portfolios found in portfolio_snapshots yet — run a Kubera sync first.");
    return;
  }

  const { error: groupsError } = await supabase
    .from("portfolio_groups")
    .upsert(groups, { onConflict: "kubera_portfolio_id" });
  if (groupsError) throw groupsError;
  console.log(`portfolio_groups: ${groups.map((g) => `${g.portfolio_name} -> ${g.group_name}`).join(", ")}`);

  // Flag biofuels as legacy in whichever portfolio it's actually in.
  const overrides: { kubera_portfolio_id: string; asset_id: string; asset_name: string; sleeve: string; note: string }[] = [];
  for (const s of snapshots ?? []) {
    for (const a of (s.assets as { id: string; name: string }[]) ?? []) {
      if (/biofuels/i.test(a.name)) {
        overrides.push({
          kubera_portfolio_id: s.kubera_portfolio_id,
          asset_id: a.id,
          asset_name: a.name,
          sleeve: "legacy",
          note: "Flagged in SOLUTION_DESIGN.md §9.2 as a legacy holding that breaches the thesis",
        });
      }
    }
  }
  if (overrides.length > 0) {
    const { error: overridesError } = await supabase
      .from("sleeve_overrides")
      .upsert(overrides, { onConflict: "kubera_portfolio_id,asset_id" });
    if (overridesError) throw overridesError;
    console.log(`sleeve_overrides: flagged ${overrides.length} biofuels holding(s) as legacy`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
