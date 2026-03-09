/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { useNavigate } from "react-router-dom"
import { apiFetch, setOn401Handler } from "@/lib/api"

export type AuthUser = {
  username: string
  role: string
  isAuthenticated: true
}

export type AuthState =
  | { isAuthenticated: false; username: null; role: null }
  | AuthUser

type AuthContextValue = {
  user: AuthState
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = React.useState<AuthState>({
    isAuthenticated: false,
    username: null,
    role: null,
  })

  // Register 401 handler — redirects to /login and clears state
  React.useEffect(() => {
    setOn401Handler(() => {
      setUser({ isAuthenticated: false, username: null, role: null })
      navigate("/login", { replace: true })
    })
  }, [navigate])

  // On mount: check session via /me
  React.useEffect(() => {
    apiFetch("/api/v1/auth/me")
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as { username: string; role: string }
          setUser({ isAuthenticated: true, username: data.username, role: data.role })
        }
      })
      .catch(() => {
        // network error — stay unauthenticated
      })
  }, [])

  const login = React.useCallback(
    async (username: string, password: string) => {
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
      navigate("/projects", { replace: true })
    },
    [navigate]
  )

  const logout = React.useCallback(async () => {
    await apiFetch("/api/v1/auth/logout", { method: "POST" })
    setUser({ isAuthenticated: false, username: null, role: null })
    navigate("/login", { replace: true })
  }, [navigate])

  const value = React.useMemo(() => ({ user, login, logout }), [user, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
