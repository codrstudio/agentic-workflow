import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface LabelConfig {
  id: string
  key: string
  displayName: string | null
  tier: string | null
  color: string | null
  icon: string | null
  background: string | null
  metadata: Record<string, unknown> | null
  createdAt: string | null
  updatedAt: string | null
}

export function useLabelConfigs() {
  return useQuery({
    queryKey: ["label-configs"],
    queryFn: () => api.get<LabelConfig[]>("/label-configs"),
    staleTime: 5 * 60 * 1_000,
  })
}

export function useCreateLabelConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      key: string
      displayName: string
      color: string
      icon?: string
      category?: string
    }) => api.post<LabelConfig>("/label-configs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-configs"] })
    },
  })
}

export function useUpdateLabelConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      key,
      data,
    }: {
      key: string
      data: {
        displayName?: string
        color?: string
        icon?: string
        category?: string
      }
    }) => api.patch<LabelConfig>(`/label-configs/${key}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-configs"] })
    },
  })
}

export function useDeleteLabelConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (key: string) =>
      api.delete<{ ok: boolean }>(`/label-configs/${key}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-configs"] })
    },
  })
}
