import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  role: string;
  displayName: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      login: async (username, password) => {
        const res = await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: username, password }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
          throw new Error(body.error ?? "Erro desconhecido");
        }

        const { token } = (await res.json()) as { token: string };
        set({ token });

        // Fetch user info after login
        const meRes = await fetch("/api/v1/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const me = (await meRes.json()) as { user: string; role: string; displayName: string };
          set({ user: { id: me.user, role: me.role, displayName: me.displayName } });
        }
      },

      logout: () => {
        set({ token: null, user: null });
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      },
    }),
    {
      name: "ab-hub-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
