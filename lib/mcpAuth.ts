import { createHash, timingSafeEqual } from "crypto";

// The remote MCP endpoint is reachable from the internet, so it is gated by a
// bearer token — a separate one per capability:
//   PHOENIX_MCP_TOKEN        read-only tools
//   PHOENIX_MCP_WRITE_TOKEN  read + the edit tools (categorise, approve, budgets)
// Unset (or shorter than 24 characters) means that scope is switched off.

export type McpScope = "read" | "write";

const MIN_LENGTH = 24;

function same(a: string, b: string): boolean {
  // compare fixed-length digests so neither length nor content leaks through timing
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function mcpScope(req: Request, env: NodeJS.ProcessEnv = process.env): McpScope | null {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const presented = m[1].trim();

  const write = env.PHOENIX_MCP_WRITE_TOKEN;
  const read = env.PHOENIX_MCP_TOKEN;
  // check both every time so the response time doesn't reveal which one exists
  const isWrite = !!write && write.length >= MIN_LENGTH && same(presented, write);
  const isRead = !!read && read.length >= MIN_LENGTH && same(presented, read);
  if (isWrite) return "write";
  if (isRead) return "read";
  return null;
}
