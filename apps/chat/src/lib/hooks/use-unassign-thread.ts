import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Gatekeeper } from "@workspace/types"
import { api } from "@/lib/api"

interface UnassignThreadVars {
  threadId: string
}

export function useUnassignThread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ threadId }: UnassignThreadVars) =>
      api.post<Gatekeeper>(`/threads/${threadId}/unassign`, {}),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["threads", vars.threadId] })
    },
  })
}
