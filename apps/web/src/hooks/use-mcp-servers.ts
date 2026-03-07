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
