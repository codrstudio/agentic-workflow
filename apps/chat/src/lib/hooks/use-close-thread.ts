import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Gatekeeper } from "@workspace/types"
import { api } from "@/lib/api"

interface CloseThreadVars {
  threadId: string
  reason?: string
}

export function useCloseThread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ threadId, reason }: CloseThreadVars) =>
      api.post<Gatekeeper>(`/threads/${threadId}/close`, reason !== undefined ? { reason } : {}),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["threads"] })
      qc.invalidateQueries({ queryKey: ["threads", vars.threadId] })
    },
  })
}
