import { appendFile } from "fs/promises";
import path from "path";

// Every tool call is logged — client identity, tool, arguments, timestamp —
// per SOLUTION_DESIGN.md §9.4 ("Constant across both tiers: every tool call
// is logged... no tool ever writes, places a trade, or moves money").
// Local JSONL file, gitignored. Never sent anywhere.
function logPath(): string {
  return process.env.MCP_AUDIT_LOG_PATH ?? path.join(__dirname, "audit.log");
}

export interface AuditEntry {
  timestamp: string;
  client: string;
  tool: string;
  args: unknown;
}

export async function logToolCall(client: string, tool: string, args: unknown): Promise<void> {
  const entry: AuditEntry = { timestamp: new Date().toISOString(), client, tool, args };
  await appendFile(logPath(), JSON.stringify(entry) + "\n", "utf-8");
}
