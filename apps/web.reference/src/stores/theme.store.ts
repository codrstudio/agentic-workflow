import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "auto";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "auto",
      setTheme: (theme: Theme) => {
        set({ theme });
        applyTheme(theme);
      },
    }),
    {
      name: "arc-theme",
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
        }
      },
    },
  ),
);

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  if (theme === "auto") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}

// Listen to system theme changes when in "auto" mode
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    const theme = useThemeStore.getState().theme;
    if (theme === "auto") {
      document.documentElement.classList.toggle("dark", e.matches);
    }
  });
}
