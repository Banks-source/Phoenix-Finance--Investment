/**
 * Lists every bank connection + account visible to your Redbark API key,
 * and whether each already has an owner mapping in redbark_account_owners.
 * Run this first, before the sync will import anything for a new account —
 * the sync deliberately refuses to guess ownership (see lib/redbarkSync.ts).
 *
 * Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *        REDBARK_API_KEY=... REDBARK_API_VERSION=... npm run redbark:accounts
 */
import { createServiceClient } from "../lib/supabase/server";
import { listConnections, listAccounts } from "../lib/redbark";

async function main() {
  const supabase = createServiceClient();
  const { data: ownerRows } = await supabase.from("redbark_account_owners").select("redbark_account_id, owner");
  const ownerMap = new Map((ownerRows ?? []).map((r) => [r.redbark_account_id, r.owner]));

  const connections = await listConnections();
  console.log(`${connections.length} connection(s):\n`);

  for (const conn of connections) {
    console.log(`${conn.institution.name} — ${conn.category} — status: ${conn.status}`);
    if (conn.status !== "active") continue;
    const accounts = await listAccounts(conn.id);
    for (const a of accounts) {
      const owner = ownerMap.get(a.id);
      const mapped = owner ? `owner: ${owner}` : "** NO OWNER MAPPED — will be skipped by sync **";
      console.log(`  ${a.id}  ${a.name} (${a.account_number ?? "no number"})  ${mapped}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
