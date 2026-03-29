import { useQuery } from "@tanstack/react-query"
import type { Derivation } from "@workspace/types"
import { api } from "@/lib/api"

export function useDerivations(threadId: string | undefined) {
  return useQuery({
    queryKey: ["derivations", threadId],
    queryFn: () => api.get<Derivation[]>(`/threads/${threadId}/derivations`),
    enabled: !!threadId,
  })
}
