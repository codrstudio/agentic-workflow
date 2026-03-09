import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  bottomNavShortcuts: string[] | null;
  setBottomNavShortcuts: (shortcuts: string[]) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      bottomNavShortcuts: null,
      setBottomNavShortcuts: (shortcuts) => set({ bottomNavShortcuts: shortcuts }),
    }),
    {
      name: "arc-ui",
    },
  ),
);
