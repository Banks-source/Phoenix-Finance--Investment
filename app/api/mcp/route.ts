import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { mcpScope } from "@/lib/mcpAuth";
import { registerPhoenixTools } from "@/lib/mcpTools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Remote MCP endpoint (Streamable HTTP, stateless). Reachable from outside the
// login wall — middleware carves out /api/mcp — so it enforces its own bearer
// token (lib/mcpAuth.ts): one token for read tools, a separate one for edits.
async function handle(req: Request): Promise<Response> {
  const scope = mcpScope(req);
  if (!scope) {
    return Response.json({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null }, { status: 401 });
  }

  const server = new McpServer({ name: "phoenix-finance", version: "1.0.0" });
  // Vercel keeps these in the function logs — the audit trail for what was asked.
  registerPhoenixTools(server, scope, (tool, args) => console.log(JSON.stringify({ mcp: tool, scope, args })));

  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
