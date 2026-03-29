import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface Attachment {
  id: string
  threadId: string
  commentId: string | null
  fileName: string
  fileType: string
  fileSize: number
  storageKey: string
  createdAt: string | null
  createdBy: string | null
}

export function useAttachments(threadId: string | undefined) {
  return useQuery({
    queryKey: ["attachments", threadId],
    queryFn: () => api.get<Attachment[]>(`/threads/${threadId}/attachments`),
    enabled: !!threadId,
  })
}

export function useInvalidateAttachments() {
  const qc = useQueryClient()
  return (threadId: string) =>
    qc.invalidateQueries({ queryKey: ["attachments", threadId] })
}

export async function uploadAttachment(
  threadId: string,
  commentId: string,
  file: File
): Promise<Attachment> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("comment_id", commentId)

  const res = await fetch(`/api/v1/chat/threads/${threadId}/attachments`, {
    method: "POST",
    body: formData,
    credentials: "include",
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload falhou" }))
    throw new Error((err as { error?: string }).error ?? "Upload falhou")
  }

  return res.json() as Promise<Attachment>
}
