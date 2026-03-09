import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Draft {
  id: string;
  agentId: string;
  label: string;
  createdAt: string;
  updatedAt: string;
  status: "draft";
}

export interface DraftDetail extends Draft {
  files: Record<string, string>;
}

export interface PublishResult {
  publishedAt: string;
  versionId: number;
}

export interface CompareResult {
  production: { text: string; usage?: unknown };
  draft: { text: string; usage?: unknown; label: string };
}

export const draftsQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["drafts", agentId],
    queryFn: () => request<Draft[]>(`/agents/${agentId}/drafts`),
  });

export const draftQueryOptions = (agentId: string, draftId: string) =>
  queryOptions({
    queryKey: ["drafts", agentId, draftId],
    queryFn: () => request<DraftDetail>(`/agents/${agentId}/drafts/${draftId}`),
  });

export function createDraft(agentId: string, label: string) {
  return request<Draft>(`/agents/${agentId}/drafts`, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export function updateDraft(
  agentId: string,
  draftId: string,
  patch: { fileName?: string; content?: string; label?: string }
) {
  return request<Draft>(`/agents/${agentId}/drafts/${draftId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteDraft(agentId: string, draftId: string) {
  return request<{ deleted: boolean }>(`/agents/${agentId}/drafts/${draftId}`, {
    method: "DELETE",
  });
}

export function publishDraft(agentId: string, draftId: string) {
  return request<PublishResult>(`/agents/${agentId}/drafts/${draftId}/publish`, {
    method: "POST",
  });
}

export function compareDraft(agentId: string, draftId: string, message: string) {
  return request<CompareResult>(`/agents/${agentId}/drafts/${draftId}/compare`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
