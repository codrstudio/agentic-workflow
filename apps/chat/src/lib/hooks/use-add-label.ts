import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Gatekeeper } from "@workspace/types"
import { api } from "@/lib/api"

interface AddLabelVars {
  threadId: string
  label: string
}

export function useAddLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ threadId, label }: AddLabelVars) =>
      api.post<Gatekeeper>(`/threads/${threadId}/labels`, { label }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["threads", vars.threadId] })
    },
  })
}
