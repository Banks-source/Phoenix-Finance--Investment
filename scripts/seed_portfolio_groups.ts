/**
 * One-time seed for the thesis engine (#4, #5, #8):
 *   - portfolio_groups: maps each known Kubera portfolio to personal/retirement
 *   - legacy_positions: flags the biofuels holding (docs/backlog-v2.5-data-layer.md
 *     names it explicitly as breaching hard rule 1 — illiquid + co-invested)
 *   - sleeve_targets: seeds the real thesis bands (same doc), left editable
 *     in the /portfolio dashboard afterward
 * Safe to re-run — everything upserts on conflict.
 *
 * Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:portfolio-groups
 */
import { createServiceClient } from "../lib/supabase/server";
import { THESIS_SLEEVES, THESIS_DEFAULT_BANDS } from "../lib/sleeves";

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

  if (seenPortfolios.size === 0) {
    console.log("No portfolios found in portfolio_snapshots yet — run a Kubera sync first.");
    return;
  }

  // 1. portfolio_groups
  const groups = [...seenPortfolios.entries()].map(([kubera_portfolio_id, portfolio_name]) => ({
    kubera_portfolio_id,
    portfolio_name,
    group_name: portfolio_name === "SMSF" ? "retirement" : "personal",
    note: "seeded by scripts/seed_portfolio_groups.ts",
  }));
  const { error: groupsError } = await supabase.from("portfolio_groups").upsert(groups, { onConflict: "kubera_portfolio_id" });
  if (groupsError) throw groupsError;
  console.log(`portfolio_groups: ${groups.map((g) => `${g.portfolio_name} -> ${g.group_name}`).join(", ")}`);

  // 2. legacy_positions — biofuels, seeded as the first entry per #8's acceptance criteria.
  const reviewDate = new Date();
  reviewDate.setDate(reviewDate.getDate() + 90);
  const legacyRows: { kubera_portfolio_id: string; asset_id: string; asset_name: string; reason: string; breached_rule: number; review_date: string }[] = [];
  for (const s of snapshots ?? []) {
    for (const a of (s.assets as { id: string; name: string }[]) ?? []) {
      if (/biofuels/i.test(a.name)) {
        legacyRows.push({
          kubera_portfolio_id: s.kubera_portfolio_id,
          asset_id: a.id,
          asset_name: a.name,
          reason: "Illiquid and co-invested — breaches hard rule 1. Predates the thesis. Exit path is an advisor-meeting agenda item.",
          breached_rule: 1,
          review_date: reviewDate.toISOString().slice(0, 10),
        });
      }
    }
  }
  if (legacyRows.length > 0) {
    const { error: legacyError } = await supabase.from("legacy_positions").upsert(legacyRows, { onConflict: "kubera_portfolio_id,asset_id" });
    if (legacyError) throw legacyError;
    console.log(`legacy_positions: flagged ${legacyRows.length} biofuels holding(s), review by ${legacyRows[0].review_date}`);
  }

  // 3. sleeve_targets — the thesis's real bands.
  const targetRows = THESIS_SLEEVES.map((sleeve) => ({
    sleeve,
    min_pct: THESIS_DEFAULT_BANDS[sleeve].min,
    max_pct: THESIS_DEFAULT_BANDS[sleeve].max,
  }));
  const { error: targetsError } = await supabase.from("sleeve_targets").upsert(targetRows, { onConflict: "sleeve" });
  if (targetsError) throw targetsError;
  console.log(`sleeve_targets: seeded ${targetRows.length} bands from the thesis doc`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
