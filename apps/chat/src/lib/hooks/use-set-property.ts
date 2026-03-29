import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Gatekeeper } from "@workspace/types"
import { api } from "@/lib/api"

interface SetPropertyVars {
  threadId: string
  key: string
  value: string
}

export function useSetProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ threadId, key, value }: SetPropertyVars) =>
      api.post<Gatekeeper>(`/threads/${threadId}/properties`, { key, value }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["threads", vars.threadId] })
    },
  })
}
