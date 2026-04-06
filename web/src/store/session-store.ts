import { create } from "zustand";
import { persist } from "zustand/middleware";

type SessionState = {
  householdId: string | null;
  activeSnapshotId: string | null;
  setSession: (p: { householdId: string; snapshotId: string }) => void;
  setActiveSnapshot: (snapshotId: string) => void;
  clear: () => void;
};

/**
 * Persists the active household and month snapshot in localStorage.
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      householdId: null,
      activeSnapshotId: null,
      setSession: ({ householdId, snapshotId }) =>
        set({ householdId, activeSnapshotId: snapshotId }),
      setActiveSnapshot: (snapshotId) => set({ activeSnapshotId: snapshotId }),
      clear: () => set({ householdId: null, activeSnapshotId: null }),
    }),
    { name: "financeiro-session" }
  )
);
