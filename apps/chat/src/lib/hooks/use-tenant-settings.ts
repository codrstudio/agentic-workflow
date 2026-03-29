import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface TenantSettings {
  tenant_name: string | null
  timezone: string | null
  language: string | null
  logo_url: string | null
}

export interface UpdateTenantSettingsBody {
  tenant_name?: string
  timezone?: string
  language?: string
}

export function useTenantSettings() {
  return useQuery({
    queryKey: ["tenant-settings"],
    queryFn: () => api.get<TenantSettings>("/settings"),
    staleTime: 60_000,
  })
}

export function useUpdateTenantSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateTenantSettingsBody) =>
      api.patch<TenantSettings>("/settings", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] })
    },
  })
}

export function useUploadTenantLogo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/v1/chat/settings/logo", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw { status: res.status, statusText: res.statusText, data }
      }
      return res.json() as Promise<TenantSettings>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] })
    },
  })
}
