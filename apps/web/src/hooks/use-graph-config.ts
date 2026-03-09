import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { sourceKeys } from "@/hooks/use-sources";

export interface CodebaseGraphConfig {
  source_id: string;
  project_id: string;
  provider: "gitnexus" | "graphiti" | "custom_mcp";
  mcp_server_url: string;
  mcp_auth_token?: string;
  mcp_tools: string[];
  repo_path?: string;
  index_patterns: string[];
  exclude_patterns: string[];
  auto_reindex_on_merge: boolean;
  last_indexed_at: string | null;
  index_status: "idle" | "indexing" | "ready" | "error";
  index_error: string | null;
  node_count: number | null;
  edge_count: number | null;
  created_at: string;
  updated_at: string;
}

export const graphConfigKeys = {
  detail: (projectSlug: string, sourceId: string) =>
    ["projects", projectSlug, "sources", sourceId, "graph-config"] as const,
};

export function useGraphConfig(projectSlug: string, sourceId: string) {
  return useQuery({
    queryKey: graphConfigKeys.detail(projectSlug, sourceId),
    queryFn: () =>
      apiFetch<CodebaseGraphConfig>(
        `/hub/projects/${projectSlug}/sources/${sourceId}/graph-config`,
      ),
    enabled: !!sourceId,
  });
}

export function usePatchGraphConfig(projectSlug: string, sourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      mcp_server_url?: string;
      mcp_auth_token?: string;
      mcp_tools?: string[];
      repo_path?: string;
      index_patterns?: string[];
      exclude_patterns?: string[];
      auto_reindex_on_merge?: boolean;
    }) =>
      apiFetch<CodebaseGraphConfig>(
        `/hub/projects/${projectSlug}/sources/${sourceId}/graph-config`,
        { method: "PATCH", body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: graphConfigKeys.detail(projectSlug, sourceId),
      });
      queryClient.invalidateQueries({
        queryKey: sourceKeys.all(projectSlug),
      });
    },
  });
}

export function useStartIndexing(projectSlug: string, sourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ job_id: string }>(
        `/hub/projects/${projectSlug}/sources/${sourceId}/index`,
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: graphConfigKeys.detail(projectSlug, sourceId),
      });
    },
  });
}

export interface IndexSSEEvent {
  type: "progress" | "complete" | "error" | "connected" | "heartbeat";
  nodes_indexed?: number;
  node_count?: number;
  edge_count?: number;
  message?: string;
}

export function subscribeIndexEvents(
  projectSlug: string,
  sourceId: string,
  callbacks: {
    onProgress: (nodesIndexed: number) => void;
    onComplete: (nodeCount: number, edgeCount: number) => void;
    onError: (message: string) => void;
  },
): AbortController {
  const controller = new AbortController();

  fetch(
    `/api/v1/hub/projects/${projectSlug}/sources/${sourceId}/index/events`,
    { signal: controller.signal },
  )
    .then(async (response) => {
      if (!response.ok) {
        callbacks.onError(`SSE connection failed: ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              switch (currentEvent) {
                case "progress":
                  callbacks.onProgress(data.nodes_indexed ?? 0);
                  break;
                case "complete":
                  callbacks.onComplete(
                    data.node_count ?? 0,
                    data.edge_count ?? 0,
                  );
                  break;
                case "error":
                  callbacks.onError(data.message ?? "Unknown error");
                  break;
              }
            } catch {
              // skip malformed JSON
            }
            currentEvent = "";
          }
        }
      }
    })
    .catch((err: Error) => {
      if (err.name === "AbortError") return;
      callbacks.onError(err.message);
    });

  return controller;
}
