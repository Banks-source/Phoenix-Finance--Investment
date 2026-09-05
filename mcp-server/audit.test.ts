import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, unlink } from "fs/promises";
import path from "path";
import { logToolCall } from "./audit";

const TEST_LOG = path.join(__dirname, "audit.test.log");

beforeEach(() => {
  process.env.MCP_AUDIT_LOG_PATH = TEST_LOG;
});

afterEach(async () => {
  delete process.env.MCP_AUDIT_LOG_PATH;
  await unlink(TEST_LOG).catch(() => {});
});

describe("logToolCall", () => {
  it("appends one JSON line per call with client, tool, args and a timestamp", async () => {
    await logToolCall("Claude Desktop/0.1", "search_transactions", { owner: "lloyd" });
    await logToolCall("Claude Desktop/0.1", "list_accounts", {});

    const content = await readFile(TEST_LOG, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]);
    expect(first.client).toBe("Claude Desktop/0.1");
    expect(first.tool).toBe("search_transactions");
    expect(first.args).toEqual({ owner: "lloyd" });
    expect(new Date(first.timestamp).toString()).not.toBe("Invalid Date");
  });
});
