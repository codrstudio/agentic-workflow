import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type McpTransport = "stdio" | "sse";
export type McpStatus = "disconnected" | "connecting" | "connected" | "error";

export interface McpServerConfig {
  id: string;
  name: string;
  description?: string;
  transport: McpTransport;
  command?: string;
  args: string[];
  env: Record<string, string>;
  url?: string;
  enabled: boolean;
  status: McpStatus;
  last_error?: string;
  created_at: string;
}

export interface CreateMcpServerInput {
  name: string;
  description?: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface UpdateMcpServerInput {
  name?: string;
  description?: string;
  enabled?: boolean;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export function useMcpServers(projectSlug: string) {
  return useQuery({
    queryKey: ["projects", projectSlug, "mcp-servers"],
    queryFn: async () => {
      const data = await apiFetch<{ servers: McpServerConfig[] }>(
        `/hub/projects/${projectSlug}/mcp/servers`
      );
      return data.servers;
    },
  });
}

export function useCreateMcpServer(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMcpServerInput) =>
      apiFetch<{ server: McpServerConfig }>(
        `/hub/projects/${projectSlug}/mcp/servers`,
        { method: "POST", body: JSON.stringify(input) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", projectSlug, "mcp-servers"],
      });
    },
  });
}

export function useUpdateMcpServer(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateMcpServerInput }) =>
      apiFetch<{ server: McpServerConfig }>(
        `/hub/projects/${projectSlug}/mcp/servers/${id}`,
        { method: "PATCH", body: JSON.stringify(updates) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", projectSlug, "mcp-servers"],
      });
    },
  });
}

export function useDeleteMcpServer(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(
        `/hub/projects/${projectSlug}/mcp/servers/${id}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", projectSlug, "mcp-servers"],
      });
    },
  });
}

export function useConnectMcpServer(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "connect" | "disconnect" }) =>
      apiFetch<{ server: McpServerConfig }>(
        `/hub/projects/${projectSlug}/mcp/servers/${id}/connect`,
        { method: "POST", body: JSON.stringify({ action }) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", projectSlug, "mcp-servers"],
      });
    },
  });
}

// --- Discovery hooks (F-083) ---

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export function useMcpServerTools(projectSlug: string, serverId: string) {
  return useQuery({
    queryKey: ["projects", projectSlug, "mcp-servers", serverId, "tools"],
    queryFn: async () => {
      const data = await apiFetch<{ tools: McpTool[] }>(
        `/hub/projects/${projectSlug}/mcp/servers/${serverId}/tools`
      );
      return data.tools;
    },
  });
}

export function useMcpServerResources(projectSlug: string, serverId: string) {
  return useQuery({
    queryKey: ["projects", projectSlug, "mcp-servers", serverId, "resources"],
    queryFn: async () => {
      const data = await apiFetch<{ resources: McpResource[] }>(
        `/hub/projects/${projectSlug}/mcp/servers/${serverId}/resources`
      );
      return data.resources;
    },
  });
}

export function useImportMcpResource(projectSlug: string, serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uri: string) =>
      apiFetch<{ source: { id: string; name: string } }>(
        `/hub/projects/${projectSlug}/mcp/servers/${serverId}/resources/import`,
        { method: "POST", body: JSON.stringify({ uri }) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", projectSlug, "sources"],
      });
    },
  });
}

// --- Aggregated MCP resources for chat context (F-084) ---

export interface McpServerWithResources {
  server: McpServerConfig;
  resources: McpResource[];
}

export function useMcpServersWithResources(projectSlug: string) {
  const { data: servers } = useMcpServers(projectSlug);

  const connectedServers = (servers ?? []).filter(
    (s) => s.status === "connected"
  );

  const resourceQueries = useQuery({
    queryKey: [
      "projects",
      projectSlug,
      "mcp-all-resources",
      connectedServers.map((s) => s.id).join(","),
    ],
    queryFn: async () => {
      const results: McpServerWithResources[] = [];
      for (const server of connectedServers) {
        try {
          const data = await apiFetch<{ resources: McpResource[] }>(
            `/hub/projects/${projectSlug}/mcp/servers/${server.id}/resources`
          );
          results.push({ server, resources: data.resources });
        } catch {
          results.push({ server, resources: [] });
        }
      }
      return results;
    },
    enabled: connectedServers.length > 0,
  });

  return {
    data: resourceQueries.data ?? [],
    servers: servers ?? [],
    hasConnectedServers: connectedServers.length > 0,
    isLoading: resourceQueries.isLoading,
  };
}

export function useImportMcpResourceByServer(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serverId, uri }: { serverId: string; uri: string }) =>
      apiFetch<{ source: { id: string; name: string } }>(
        `/hub/projects/${projectSlug}/mcp/servers/${serverId}/resources/import`,
        { method: "POST", body: JSON.stringify({ uri }) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", projectSlug, "sources"],
      });
    },
  });
}
