import { useQuery } from "@tanstack/react-query"
import type { Comment } from "@workspace/types"
import { api } from "@/lib/api"

export function useComments(threadId: string | undefined) {
  return useQuery({
    queryKey: ["comments", threadId],
    queryFn: () =>
      api.get<Comment[]>("/comments", {
        params: { thread_id: threadId, sort: "created_at", order: "asc" },
      }),
    enabled: !!threadId,
  })
}
