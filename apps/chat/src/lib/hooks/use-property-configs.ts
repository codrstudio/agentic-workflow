import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface PropertyConfig {
  id: string
  key: string
  displayName: string
  type: string
  options: unknown[]
  defaultValue: string | null
  required: boolean
  tier: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export function usePropertyConfigs() {
  return useQuery({
    queryKey: ["property-configs"],
    queryFn: () => api.get<PropertyConfig[]>("/property-configs"),
    staleTime: 5 * 60 * 1_000,
  })
}

export function useCreatePropertyConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      key: string
      displayName: string
      type: string
      options?: string[]
      defaultValue?: string
      required?: boolean
    }) => api.post<PropertyConfig>("/property-configs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-configs"] })
    },
  })
}

export function useUpdatePropertyConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      key,
      data,
    }: {
      key: string
      data: {
        displayName?: string
        type?: string
        options?: string[]
        defaultValue?: string
        required?: boolean
      }
    }) => api.patch<PropertyConfig>(`/property-configs/${key}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-configs"] })
    },
  })
}

export function useDeletePropertyConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (key: string) =>
      api.delete<{ ok: boolean }>(`/property-configs/${key}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-configs"] })
    },
  })
}
