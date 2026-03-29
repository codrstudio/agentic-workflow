import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Comment } from "@workspace/types"
import { api } from "@/lib/api"

interface CreateCommentBody {
  thread_id: string
  text: string
  visibility: string
  channel: string
}

export function useCreateComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCommentBody) =>
      api.post<Comment>("/comments", body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["comments", vars.thread_id] })
    },
  })
}
