import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface SLAConfig {
  id: string
  priority: string
  first_response_minutes: number
  resolution_minutes: number
  warning_percent: number
}

export interface UpdateSLAConfigBody {
  firstResponseMinutes?: number
  resolutionMinutes?: number
  warningPercent?: number
}

export function useSLAConfigs() {
  return useQuery({
    queryKey: ["sla-configs"],
    queryFn: () => api.get<SLAConfig[]>("/sla-configs"),
    staleTime: 60_000,
  })
}

export function useUpdateSLAConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ priority, body }: { priority: string; body: UpdateSLAConfigBody }) =>
      api.patch<SLAConfig>(`/sla-configs/${priority}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-configs"] })
    },
  })
}
