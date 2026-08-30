/**
 * Manual/local run of the Kubera portfolio sync (same logic the nightly
 * Vercel Cron job at /api/kubera/sync runs). Useful for a first sync before
 * the cron job exists, or for debugging without waiting for the schedule.
 *
 * Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *        KUBERA_API_KEY=... KUBERA_API_SECRET=... npm run kubera:sync
 */
import { runKuberaSync } from "../lib/kuberaSync";

async function main() {
  const result = await runKuberaSync();
  console.log(`synced ${result.portfolios.length} portfolio(s) at ${result.syncedAt}`);
  for (const p of result.portfolios) {
    console.log(`  ${p.name} (${p.id}): ${p.netWorth} ${p.currency}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
