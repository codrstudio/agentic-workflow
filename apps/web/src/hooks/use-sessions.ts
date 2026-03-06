import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  artifacts: string[];
}

export interface SessionSummary {
  id: string;
  project_id: string;
  title: string;
  source_ids: string[];
  created_at: string;
  updated_at: string;
  status: "active" | "archived";
  message_count: number;
  last_message_preview: string | null;
  last_message_role: "user" | "assistant" | "system" | null;
}

export interface SessionDetail {
  id: string;
  project_id: string;
  title: string;
  source_ids: string[];
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
  status: "active" | "archived";
}

export const sessionKeys = {
  all: (projectSlug: string) => ["projects", projectSlug, "sessions"] as const,
  list: (projectSlug: string) =>
    [...sessionKeys.all(projectSlug), "list"] as const,
  detail: (projectSlug: string, sessionId: string) =>
    [...sessionKeys.all(projectSlug), sessionId] as const,
};

export function useSessions(projectSlug: string) {
  return useQuery({
    queryKey: sessionKeys.list(projectSlug),
    queryFn: () =>
      apiFetch<SessionSummary[]>(`/hub/projects/${projectSlug}/sessions`),
  });
}

export function useSession(projectSlug: string, sessionId: string) {
  return useQuery({
    queryKey: sessionKeys.detail(projectSlug, sessionId),
    queryFn: () =>
      apiFetch<SessionDetail>(
        `/hub/projects/${projectSlug}/sessions/${sessionId}`,
      ),
    enabled: !!sessionId,
  });
}

export function useCreateSession(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { title?: string; source_ids?: string[] }) =>
      apiFetch<SessionSummary>(`/hub/projects/${projectSlug}/sessions`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: sessionKeys.all(projectSlug),
      });
    },
  });
}
