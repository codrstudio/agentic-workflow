import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface KnowledgeDoc {
  id: number;
  filename: string;
  slug: string;
  contentType: string;
  sizeBytes: number;
  chunks: number;
  status: string;
  error: string | null;
  createdAt: string;
}

export function knowledgeDocsQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["knowledge", agentId],
    queryFn: () =>
      request<{ docs: KnowledgeDoc[] }>(`/agents/${agentId}/knowledge`),
  });
}

export function knowledgeDocQueryOptions(agentId: string, docId: number) {
  return queryOptions({
    queryKey: ["knowledge", agentId, docId],
    queryFn: () =>
      request<KnowledgeDoc>(`/agents/${agentId}/knowledge/${docId}`),
  });
}

export async function uploadKnowledgeDoc(
  agentId: string,
  file: File,
): Promise<KnowledgeDoc> {
  const { useAuthStore } = await import("@/lib/auth");
  const token = useAuthStore.getState().token;

  const form = new FormData();
  form.append("file", file);

  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`/api/v1/ai/agents/${agentId}/knowledge`, {
    method: "POST",
    headers,
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || "Upload failed");
  }

  return res.json() as Promise<KnowledgeDoc>;
}

export async function deleteKnowledgeDoc(
  agentId: string,
  docId: number,
): Promise<void> {
  await request(`/agents/${agentId}/knowledge/${docId}`, { method: "DELETE" });
}
