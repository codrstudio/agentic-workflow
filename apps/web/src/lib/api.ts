const BASE_PATH = "/api/v1/ai";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}`);
    this.name = "ApiError";
  }
}

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const { useAuthStore } = await import("./auth.js");
  const token = useAuthStore.getState().token;

  const headers = new Headers(options?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (
    !headers.has("Content-Type") &&
    options?.body &&
    typeof options.body === "string"
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE_PATH}${path}`, { ...options, headers });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new ApiError(401, { error: "unauthorized" });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const { useAuthStore } = await import("./auth.js");
  const token = useAuthStore.getState().token;

  const headers = new Headers(options?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (
    !headers.has("Content-Type") &&
    options?.body &&
    typeof options.body === "string"
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path.startsWith("/api") ? path : `/api/v1${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new ApiError(401, { error: "unauthorized" });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}
