import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Gatekeeper } from "@workspace/types"
import { api } from "@/lib/api"

interface AssignThreadVars {
  threadId: string
  assignee_id: string
}

export function useAssignThread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ threadId, assignee_id }: AssignThreadVars) =>
      api.post<Gatekeeper>(`/threads/${threadId}/assign`, { assignee_id }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["threads", vars.threadId] })
    },
  })
}
