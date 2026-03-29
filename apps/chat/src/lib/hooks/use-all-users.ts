import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface TeamMember {
  id: string
  name: string | null
  email: string
  role: "admin" | "manager" | "attendant"
  status: "active" | "inactive"
  createdAt: string
  lastLoginAt: string | null
}

export function useAllUsers() {
  return useQuery({
    queryKey: ["users", "all"],
    queryFn: () => api.get<TeamMember[]>("/users/all"),
    staleTime: 30 * 1000,
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch<TeamMember>(`/users/${id}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "all"] })
    },
  })
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch<TeamMember>(`/users/${id}/status`, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "all"] })
    },
  })
}

export function useInviteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; email: string; role: string }) =>
      api.post<TeamMember>("/users/invite", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "all"] })
    },
  })
}
