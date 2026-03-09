import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface UserPermissions {
  canCreateAgents: boolean;
  canCreateChannels: boolean;
  maxAgents: number;
}

export interface User {
  slug: string;
  displayName: string;
  email: string;
  permissions: UserPermissions;
}

export function usersQueryOptions() {
  return queryOptions({
    queryKey: ["users"],
    queryFn: () => request<User[]>("/users"),
  });
}

export interface CreateUserPayload {
  slug: string;
  displayName: string;
  password: string;
  email?: string;
  permissions?: Partial<UserPermissions>;
}

export interface UpdateUserPayload {
  displayName?: string;
  email?: string;
  password?: string;
  permissions?: Partial<UserPermissions>;
}

export function createUser(payload: CreateUserPayload) {
  return request<User>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateUser(slug: string, payload: UpdateUserPayload) {
  return request<User>(`/users/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteUser(slug: string) {
  return request<{ status: string }>(`/users/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}

export interface UserAgent {
  id: string;
  slug: string;
  enabled: boolean;
  description: string;
}

export function userAgentsQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["users", slug, "agents"],
    queryFn: () => request<UserAgent[]>(`/users/${encodeURIComponent(slug)}/agents`),
    enabled: !!slug,
  });
}
