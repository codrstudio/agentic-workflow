/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { apiFetch, setOn401Handler } from "@/lib/api"
import { router } from "@/router"

export type AuthUser = {
  username: string
  role: string
  isAuthenticated: true
}

export type AuthState =
  | { isAuthenticated: false; username: null; role: null }
  | AuthUser

export type AuthContextValue = {
  user: AuthState
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthState>({
    isAuthenticated: false,
    username: null,
    role: null,
  })

  // Register 401 handler — redirects to /login and clears state
  React.useEffect(() => {
    setOn401Handler(() => {
      setUser({ isAuthenticated: false, username: null, role: null })
      void router.navigate({ to: "/login", replace: true })
      void router.invalidate()
    })
  }, [])

  // On mount: check session via /me
  React.useEffect(() => {
    apiFetch("/api/v1/auth/me")
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as { username: string; role: string }
          setUser({ isAuthenticated: true, username: data.username, role: data.role })
          void router.invalidate()
        }
      })
      .catch(() => {
        // network error — stay unauthenticated
      })
  }, [])

  const login = React.useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })

    if (!res.ok) {
      throw new Error("Invalid credentials")
    }

    // Fetch user info after successful login
    const meRes = await apiFetch("/api/v1/auth/me")
    if (!meRes.ok) throw new Error("Failed to fetch user info")

    const data = (await meRes.json()) as { username: string; role: string }
    setUser({ isAuthenticated: true, username: data.username, role: data.role })
    void router.invalidate()
    void router.navigate({ to: "/projects", replace: true })
  }, [])

  const logout = React.useCallback(async () => {
    await apiFetch("/api/v1/auth/logout", { method: "POST" })
    setUser({ isAuthenticated: false, username: null, role: null })
    void router.invalidate()
    void router.navigate({ to: "/login", replace: true })
  }, [])

  const value = React.useMemo(() => ({ user, login, logout }), [user, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
