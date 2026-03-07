import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DismissedEntry {
  projectId: string;
  dismissedAt: string;
}

interface ResumeBannerState {
  dismissed: DismissedEntry[];
  dismiss: (projectId: string) => void;
  isDismissed: (projectId: string, thresholdHours: number) => boolean;
}

export const useResumeBannerStore = create<ResumeBannerState>()(
  persist(
    (set, get) => ({
      dismissed: [],
      dismiss: (projectId) =>
        set((state) => ({
          dismissed: [
            ...state.dismissed.filter((d) => d.projectId !== projectId),
            { projectId, dismissedAt: new Date().toISOString() },
          ],
        })),
      isDismissed: (projectId, thresholdHours) => {
        const entry = get().dismissed.find((d) => d.projectId === projectId);
        if (!entry) return false;
        const dismissedAt = new Date(entry.dismissedAt).getTime();
        const now = Date.now();
        const hoursSinceDismiss = (now - dismissedAt) / (1000 * 60 * 60);
        return hoursSinceDismiss < thresholdHours;
      },
    }),
    {
      name: "arc-resume-banner",
    },
  ),
);
