/**
 * Thin fetch wrapper that intercepts 401 responses and redirects to /login.
 * Import this instead of raw `fetch` for all API calls.
 */

type Redirect401Handler = () => void

let on401: Redirect401Handler = () => {
  window.location.href = "/login"
}

export function setOn401Handler(handler: Redirect401Handler) {
  on401 = handler
}

export async function apiFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, { credentials: "include", ...init })
  if (res.status === 401) {
    on401()
  }
  return res
}
