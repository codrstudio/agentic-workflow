import { McpClient, type McpStatus } from "./mcp-client.js";

interface ServerConfig {
  id: string;
  transport: "stdio" | "sse";
  command?: string;
  args: string[];
  env: Record<string, string>;
  url?: string;
  enabled: boolean;
}

interface ManagedClient {
  client: McpClient;
  serverId: string;
}

/**
 * McpManager manages MCP client connections per project.
 * One McpManager instance per project slug.
 */
class McpManager {
  private clients = new Map<string, ManagedClient>();

  async connect(server: ServerConfig): Promise<{ status: McpStatus; last_error?: string }> {
    // Disconnect existing client for this server if any
    await this.disconnect(server.id);

    const client = new McpClient({
      transport: server.transport,
      command: server.command,
      args: server.args,
      env: server.env,
      url: server.url,
    });

    this.clients.set(server.id, { client, serverId: server.id });

    try {
      await client.connect();
      return { status: client.status };
    } catch {
      return { status: client.status, last_error: client.lastError };
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const managed = this.clients.get(serverId);
    if (managed) {
      await managed.client.disconnect();
      this.clients.delete(serverId);
    }
  }

  getClient(serverId: string): McpClient | undefined {
    return this.clients.get(serverId)?.client;
  }

  getStatus(serverId: string): { status: McpStatus; last_error?: string } {
    const managed = this.clients.get(serverId);
    if (!managed) {
      return { status: "disconnected" };
    }
    return {
      status: managed.client.status,
      last_error: managed.client.lastError,
    };
  }

  async disconnectAll(): Promise<void> {
    const disconnects = Array.from(this.clients.keys()).map((id) =>
      this.disconnect(id),
    );
    await Promise.allSettled(disconnects);
  }
}

// Global registry: one McpManager per project slug
const managers = new Map<string, McpManager>();

export function getMcpManager(projectSlug: string): McpManager {
  let manager = managers.get(projectSlug);
  if (!manager) {
    manager = new McpManager();
    managers.set(projectSlug, manager);
  }
  return manager;
}

export async function destroyMcpManager(projectSlug: string): Promise<void> {
  const manager = managers.get(projectSlug);
  if (manager) {
    await manager.disconnectAll();
    managers.delete(projectSlug);
  }
}
