#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getPool } from "./db";
import { searchTransactions, listAccounts, getWalletDetail } from "./tools";
import { logToolCall } from "./audit";

// Local stdio MCP server — tier B (#14). Full-detail access (transaction line
// items, account/wallet detail) for a model running on this machine only.
// Never deployed, never network-reachable — that's the whole point. See
// mcp-server/README.md for Claude Desktop / LM Studio / llama.cpp setup.

const server = new McpServer({ name: "phoenix-finance-tier-b", version: "1.0.0" });

function clientIdentity(): string {
  const info = server.server.getClientVersion();
  return info ? `${info.name}/${info.version}` : "unknown-client";
}

server.registerTool(
  "search_transactions",
  {
    title: "Search transactions",
    description:
      "Search household transaction line items (budget side — NAB/CBA/Redbark bank feed), full detail, no aggregation. Filter by date range, owner, category, merchant substring, type, or status.",
    inputSchema: {
      from: z.string().optional().describe("ISO date, inclusive"),
      to: z.string().optional().describe("ISO date, inclusive"),
      owner: z.enum(["lloyd", "milani", "joint"]).optional(),
      category: z.string().optional(),
      merchant: z.string().optional().describe("substring match, case-insensitive"),
      type: z.enum(["spending", "bills_fixed", "transfers", "debt", "income", "needs_categorisation"]).optional(),
      status: z.enum(["approved", "pending_review"]).optional(),
      limit: z.number().int().min(1).max(500).optional().describe("default 100, max 500"),
    },
  },
  async (args) => {
    await logToolCall(clientIdentity(), "search_transactions", args);
    const rows = await searchTransactions(getPool(), args);
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

server.registerTool(
  "list_accounts",
  {
    title: "List accounts",
    description:
      "List household bank accounts (institution, masked account number, owner, whether it's linked to the automated Redbark bank feed). No balances — Phoenix's budget side tracks transaction history, not live balances.",
    inputSchema: {
      owner: z.enum(["lloyd", "milani", "joint"]).optional(),
    },
  },
  async (args) => {
    await logToolCall(clientIdentity(), "list_accounts", args);
    const rows = await listAccounts(getPool(), args.owner);
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

server.registerTool(
  "get_wallet_detail",
  {
    title: "Get wallet/portfolio detail",
    description:
      "Full holdings detail for Kubera-connected portfolios (crypto wallets, brokerage, bank/investment accounts) — latest snapshot per portfolio, including every individual asset/debt line item (ticker, sector, geography, quantity, etc). Optionally filter by portfolio name substring.",
    inputSchema: {
      portfolioName: z.string().optional().describe("substring match, case-insensitive, e.g. 'SMSF'"),
    },
  },
  async (args) => {
    await logToolCall(clientIdentity(), "get_wallet_detail", args);
    const rows = await getWalletDetail(getPool(), args.portfolioName);
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
