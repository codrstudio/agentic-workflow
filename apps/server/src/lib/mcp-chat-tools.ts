import { getMcpManager } from "./mcp-manager.js";
import { readJSON } from "./fs-utils.js";
import { config } from "./config.js";
import path from "node:path";

// --- Types ---

export interface McpToolDefinition {
  /** Namespaced: "mcp:{server_name}:{tool_name}" */
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
  serverName: string;
  originalName: string;
}

export interface McpToolCallRequest {
  toolName: string;
  args: Record<string, unknown>;
}

export interface McpToolCallResult {
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

interface McpServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "sse";
  enabled: boolean;
}

// --- Collect MCP tools from connected servers ---

export async function collectMcpTools(
  projectSlug: string,
): Promise<McpToolDefinition[]> {
  const manager = getMcpManager(projectSlug);

  // Load server configs
  let servers: McpServerConfig[] = [];
  try {
    const serversPath = path.join(
      config.projectsDir,
      projectSlug,
      "mcp",
      "servers.json",
    );
    servers = await readJSON<McpServerConfig[]>(serversPath);
  } catch {
    return [];
  }

  const tools: McpToolDefinition[] = [];

  for (const server of servers) {
    if (!server.enabled) continue;

    const client = manager.getClient(server.id);
    if (!client || client.status !== "connected") continue;

    try {
      const serverTools = await client.listTools();
      for (const tool of serverTools) {
        tools.push({
          name: `mcp__${sanitizeName(server.name)}__${sanitizeName(tool.name)}`,
          description: tool.description || `MCP tool from ${server.name}`,
          inputSchema: tool.inputSchema,
          serverId: server.id,
          serverName: server.name,
          originalName: tool.name,
        });
      }
    } catch {
      // Skip servers that fail tool listing — don't break the chat
    }
  }

  return tools;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// --- Format MCP tools for system prompt ---

export function formatMcpToolsForPrompt(tools: McpToolDefinition[]): string {
  if (tools.length === 0) return "";

  const toolDescriptions = tools.map((tool) => {
    const schemaStr = JSON.stringify(tool.inputSchema, null, 2);
    return [
      `### ${tool.name}`,
      tool.description,
      `**Server:** ${tool.serverName}`,
      `**Input Schema:**`,
      "```json",
      schemaStr,
      "```",
    ].join("\n");
  });

  return [
    "## MCP Tools",
    "",
    "The following MCP tools are available. To call a tool, include a tool call block in your response:",
    "",
    "```",
    '<mcp_tool_call tool="TOOL_NAME">',
    '{"param1": "value1"}',
    "</mcp_tool_call>",
    "```",
    "",
    "You may include multiple tool calls in a single response. After tool execution, you will receive the results and can continue your response.",
    "",
    ...toolDescriptions,
  ].join("\n");
}

// --- Parse MCP tool calls from assistant response ---

const MCP_TOOL_CALL_REGEX =
  /<mcp_tool_call\s+tool="([^"]+)">\s*([\s\S]*?)\s*<\/mcp_tool_call>/g;

export function parseMcpToolCalls(
  responseText: string,
): McpToolCallRequest[] {
  const calls: McpToolCallRequest[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  MCP_TOOL_CALL_REGEX.lastIndex = 0;

  while ((match = MCP_TOOL_CALL_REGEX.exec(responseText)) !== null) {
    const toolName = match[1]!;
    const argsStr = match[2]!;
    try {
      const args = JSON.parse(argsStr) as Record<string, unknown>;
      calls.push({ toolName, args });
    } catch {
      // Invalid JSON in tool call — skip
      calls.push({ toolName, args: {} });
    }
  }

  return calls;
}

// --- Execute MCP tool calls ---

export async function executeMcpToolCall(
  projectSlug: string,
  toolName: string,
  args: Record<string, unknown>,
  tools: McpToolDefinition[],
): Promise<McpToolCallResult> {
  const toolDef = tools.find((t) => t.name === toolName);
  if (!toolDef) {
    return {
      toolName,
      success: false,
      error: `Unknown MCP tool: ${toolName}`,
    };
  }

  const manager = getMcpManager(projectSlug);
  const client = manager.getClient(toolDef.serverId);

  if (!client || client.status !== "connected") {
    return {
      toolName,
      success: false,
      error: `MCP server "${toolDef.serverName}" is not connected`,
    };
  }

  try {
    const result = await client.callTool(toolDef.originalName, args);
    return { toolName, success: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { toolName, success: false, error: message };
  }
}

// --- Format tool results for follow-up prompt ---

export function formatToolResults(results: McpToolCallResult[]): string {
  return results
    .map((r) => {
      if (r.success) {
        const resultStr =
          typeof r.result === "string"
            ? r.result
            : JSON.stringify(r.result, null, 2);
        return `<mcp_tool_result tool="${r.toolName}" status="success">\n${resultStr}\n</mcp_tool_result>`;
      }
      return `<mcp_tool_result tool="${r.toolName}" status="error">\n${r.error}\n</mcp_tool_result>`;
    })
    .join("\n\n");
}
