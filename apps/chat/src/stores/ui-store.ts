import { create } from "zustand"

// Sidebar state is managed by shadcn SidebarProvider.
// This store is for other UI-only state (drawers, modals, etc.)

interface UIStore {
  // placeholder for future UI state
}

export const useUIStore = create<UIStore>(() => ({}))
