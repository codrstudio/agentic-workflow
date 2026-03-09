import { create } from "zustand";

interface SessionTimerState {
  /** When the current session started (epoch ms) */
  sessionStartedAt: number;
  /** When the last break reminder was shown or dismissed (epoch ms) */
  lastBreakReminderAt: number;
  /** Whether break reminders are disabled for today */
  breakRemindersDisabledToday: boolean;
  /** Date string (YYYY-MM-DD) when reminders were disabled */
  disabledDate: string | null;
  /** Whether the break reminder overlay is currently visible */
  breakReminderVisible: boolean;
  /** Whether the session duration alert banner has been dismissed */
  sessionAlertDismissed: boolean;

  // Actions
  startSession: () => void;
  showBreakReminder: () => void;
  dismissBreakReminder: () => void;
  disableBreakRemindersToday: () => void;
  dismissSessionAlert: () => void;
  resetSessionAlert: () => void;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useSessionTimerStore = create<SessionTimerState>()((set) => ({
  sessionStartedAt: Date.now(),
  lastBreakReminderAt: Date.now(),
  breakRemindersDisabledToday: false,
  disabledDate: null,
  breakReminderVisible: false,
  sessionAlertDismissed: false,

  startSession: () =>
    set({
      sessionStartedAt: Date.now(),
      lastBreakReminderAt: Date.now(),
      breakReminderVisible: false,
      sessionAlertDismissed: false,
    }),

  showBreakReminder: () => set({ breakReminderVisible: true }),

  dismissBreakReminder: () =>
    set({
      breakReminderVisible: false,
      lastBreakReminderAt: Date.now(),
    }),

  disableBreakRemindersToday: () =>
    set({
      breakReminderVisible: false,
      breakRemindersDisabledToday: true,
      disabledDate: todayString(),
    }),

  dismissSessionAlert: () => set({ sessionAlertDismissed: true }),

  resetSessionAlert: () => set({ sessionAlertDismissed: false }),
}));
