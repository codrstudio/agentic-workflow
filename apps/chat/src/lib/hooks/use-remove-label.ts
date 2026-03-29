import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

interface RemoveLabelVars {
  threadId: string
  slug: string
}

export function useRemoveLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ threadId, slug }: RemoveLabelVars) =>
      api.delete<void>(`/threads/${threadId}/labels/${slug}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["threads", vars.threadId] })
    },
  })
}
