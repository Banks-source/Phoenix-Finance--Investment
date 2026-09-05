import { Pool } from "pg";

// Tier-B server connects with a genuinely separate, read-only Postgres
// credential (see supabase/migrations/0006... — actually the mcp_readonly
// role is provisioned via the SQL sent directly to Lloyd, never committed as
// a migration, since it creates a role/grants — not tracked here). Never the
// service-role key. If MCP_DB_URL is unset, every query fails loudly rather
// than silently falling back to anything with broader access.
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.MCP_DB_URL;
    if (!connectionString) {
      throw new Error("MCP_DB_URL is not set — see mcp-server/README.md");
    }
    pool = new Pool({ connectionString, max: 3 });
  }
  return pool;
}
