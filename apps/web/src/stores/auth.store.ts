import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  role: string;
  displayName: string;
}

const MOCK_USER: AuthUser = {
  id: "local-user",
  role: "admin",
  displayName: "Local User",
};

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: () => set({ isAuthenticated: true, user: MOCK_USER }),
      logout: () => set({ isAuthenticated: false, user: null }),
    }),
    {
      name: "arc-auth",
    },
  ),
);
