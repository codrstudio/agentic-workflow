import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DismissedEntry {
  projectId: string;
  dismissedAt: string;
}

interface ResumeProfileEntry {
  projectId: string;
  profileId: string | null;
}

interface ResumeBannerState {
  dismissed: DismissedEntry[];
  resumeProfiles: ResumeProfileEntry[];
  dismiss: (projectId: string) => void;
  isDismissed: (projectId: string, thresholdHours: number) => boolean;
  setResumeProfileId: (projectId: string, profileId: string | null) => void;
  consumeResumeProfileId: (projectId: string) => string | null;
}

export const useResumeBannerStore = create<ResumeBannerState>()(
  persist(
    (set, get) => ({
      dismissed: [],
      resumeProfiles: [],
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
      setResumeProfileId: (projectId, profileId) =>
        set((state) => ({
          resumeProfiles: [
            ...state.resumeProfiles.filter((r) => r.projectId !== projectId),
            { projectId, profileId },
          ],
        })),
      consumeResumeProfileId: (projectId) => {
        const entry = get().resumeProfiles.find((r) => r.projectId === projectId);
        if (!entry) return null;
        set((state) => ({
          resumeProfiles: state.resumeProfiles.filter((r) => r.projectId !== projectId),
        }));
        return entry.profileId;
      },
    }),
    {
      name: "arc-resume-banner",
    },
  ),
);
