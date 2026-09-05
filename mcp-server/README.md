# Phoenix Finance — Tier B local MCP server

Full-detail access (transaction line items, account/wallet detail) for a
model running on **this machine only** — Claude Desktop, or a local model via
LM Studio / llama.cpp. See `SOLUTION_DESIGN.md` §9.4 for the two-tier design
this implements the local half of.

**This server is never deployed and never network-reachable.** It's a stdio
process a local MCP client launches directly — there is no HTTP endpoint,
no port, nothing for anything outside this machine to connect to. That's the
whole point: full detail on financial data with live creditor matters in
play shouldn't traverse a third-party LLM provider unless that's a decision
made deliberately (see the remote tier-A server, if/when that's built).

## One-time setup: the read-only database role

The server connects with a Postgres role that has **no write grants at all**
— a genuinely separate credential from the app's service-role key, not just
a different permission check in application code.

1. Run the SQL you already have (`mcp_readonly_role.sql`) in the Supabase SQL
   editor if you haven't yet — it creates the role and RLS policies scoped to
   exactly `transactions`, `accounts`, `categories`, `portfolio_snapshots`.
2. Set its password there too (never in a file):
   ```sql
   alter role mcp_readonly with password '<openssl rand -hex 24>';
   ```
3. Build the connection string from Supabase → Project Settings → Database →
   Connection string, swapping in `mcp_readonly` and its password for the
   default `postgres` user:
   ```
   postgresql://mcp_readonly:<password>@<host>:5432/postgres
   ```
4. Put that in `.env.local` as `MCP_DB_URL` (or wherever you'll run the
   server from) — never in a committed file.

## Try it locally first

```bash
MCP_DB_URL=postgresql://mcp_readonly:...@...  npm run mcp:server
```

It won't print anything on success — it's now waiting on stdin for an MCP
client to connect. Ctrl-C to stop. If `MCP_DB_URL` is missing or wrong,
tool calls will fail with a clear error rather than falling back to broader
access.

## Claude Desktop

Edit Claude Desktop's config (Settings → Developer → Edit Config, or
directly at `~/Library/Application Support/Claude/claude_desktop_config.json`
on macOS):

```json
{
  "mcpServers": {
    "phoenix-finance": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-server/index.ts"],
      "env": {
        "MCP_DB_URL": "postgresql://mcp_readonly:...@...:5432/postgres"
      }
    }
  }
}
```

Restart Claude Desktop. The three tools (`search_transactions`,
`list_accounts`, `get_wallet_detail`) should appear as available to Claude in
a new conversation.

## LM Studio

LM Studio's MCP support (Program tab → Install → Edit `mcp.json`) uses the
same config shape as Claude Desktop above — same `command`/`args`/`env`
block, under LM Studio's own `mcpServers` key.

## llama.cpp

llama.cpp itself doesn't speak MCP directly; run it behind an MCP-aware
client/bridge (e.g. an OpenAI-compatible proxy that supports tool calling
against a local server) and point that bridge at this same
`command`/`args`/`env` configuration.

## Audit log

Every tool call — client identity (from the connecting MCP client's
`name`/`version`), tool name, arguments, timestamp — is appended to
`mcp-server/audit.log` (gitignored, local only, never rotated automatically).
Same logging discipline the design doc specifies for the remote tier-A
server, so both tiers are auditable the same way.

## What this doesn't do

No tool here writes, updates, or deletes anything — the `mcp_readonly` role
has no write grants, so this is structurally enforced at the database level,
not just by convention in this code.
