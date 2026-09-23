"use client";

import { create } from "zustand";

// Transient per-object geometry-compute status (S19). This is runtime UI
// state only: it is never persisted, never serialized into scenes, shares,
// exports, or history. It exists so the object list can honestly show a
// pending indicator while a worker request is the newest outstanding one.
//
// Lifecycle (owned by the compute manager, never written directly by UI):
// - requestCompute -> "pending"
// - accepted ok/empty result -> cleared back to idle ("ready clears it")
// - accepted error/budget result -> "error" with message
// - stale (superseded) responses -> no status change, never clear a newer pending
// - object removed / manager disposed -> cleared
// The collapsed "ready" state is deliberate: an applied result simply means
// "no longer pending". No aria-live announcements: the indicator is a silent
// visual dot (role="img" + label) so rapid editing never spams announcements.

export type GeometryComputeStatus = "idle" | "pending" | "error";

export interface GeometryComputeStatusEntry {
  status: Exclude<GeometryComputeStatus, "idle">;
  message?: string;
  updatedAt: number;
}

interface GeometryComputeStatusState {
  entries: Record<string, GeometryComputeStatusEntry>;
  setStatus: (objectId: string, status: Exclude<GeometryComputeStatus, "idle">, message?: string) => void;
  clearStatus: (objectId: string) => void;
  clearAll: () => void;
}

export const useGeometryComputeStore = create<GeometryComputeStatusState>()((set) => ({
  entries: {},
  setStatus: (objectId, status, message) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [objectId]: { status, message, updatedAt: Date.now() }
      }
    })),
  clearStatus: (objectId) =>
    set((state) => {
      if (!(objectId in state.entries)) {
        return state;
      }
      const entries = { ...state.entries };
      delete entries[objectId];
      return { entries };
    }),
  clearAll: () => set({ entries: {} })
}));

export function getComputeStatusForObject(objectId: string): GeometryComputeStatus {
  return useGeometryComputeStore.getState().entries[objectId]?.status ?? "idle";
}
