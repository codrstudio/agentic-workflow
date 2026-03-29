import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Gatekeeper } from "@workspace/types"
import { api } from "@/lib/api"

interface ReopenThreadVars {
  threadId: string
  text?: string
}

export function useReopenThread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ threadId, text }: ReopenThreadVars) =>
      api.post<Gatekeeper>(`/threads/${threadId}/reopen`, text !== undefined ? { text } : {}),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["threads"] })
      qc.invalidateQueries({ queryKey: ["threads", vars.threadId] })
    },
  })
}
