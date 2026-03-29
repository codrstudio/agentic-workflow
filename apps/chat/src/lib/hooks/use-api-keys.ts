import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface ApiKey {
  id: string
  name: string
  prefix: string
  permissions: string[]
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  status: "active" | "revoked" | "expired"
}

export interface CreatedApiKey extends ApiKey {
  key: string
}

export interface CreateApiKeyBody {
  name: string
  permissions: string[]
  expires_at?: string
}

export function useApiKeys() {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.get<ApiKey[]>("/api-keys"),
    staleTime: 30_000,
  })
}

export function useCreateApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateApiKeyBody) =>
      api.post<CreatedApiKey>("/api-keys", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] })
    },
  })
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ success: boolean; revoked_at: string }>(`/api-keys/${id}/revoke`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] })
    },
  })
}
