"use client";

import { create } from "zustand";
import type { SceneSnapshot } from "@/lib/types/scene";

interface HistoryStoreState {
  past: SceneSnapshot[];
  future: SceneSnapshot[];
  pushSnapshot: (snapshot: SceneSnapshot) => void;
  undo: (current: SceneSnapshot) => SceneSnapshot | null;
  redo: (current: SceneSnapshot) => SceneSnapshot | null;
  clear: () => void;
}

// S29-R2: bound the undo stack. Previously unbounded, long sessions grew
// `past` linearly (every debounced equation commit pushes). Cap at 100
// snapshots (FIFO eviction); redo is still cleared on push.
export const MAX_HISTORY_SNAPSHOTS = 100;

export const useHistoryStore = create<HistoryStoreState>((set, get) => ({
  past: [],
  future: [],
  pushSnapshot: (snapshot) => {
    set((state) => {
      const nextPast =
        state.past.length >= MAX_HISTORY_SNAPSHOTS
          ? [...state.past.slice(state.past.length - MAX_HISTORY_SNAPSHOTS + 1), snapshot]
          : [...state.past, snapshot];
      return {
        past: nextPast,
        future: []
      };
    });
  },
  undo: (current) => {
    const { past, future } = get();
    const previous = past[past.length - 1];
    if (!previous) {
      return null;
    }
    set({
      past: past.slice(0, -1),
      future: [current, ...future]
    });
    return previous;
  },
  redo: (current) => {
    const { past, future } = get();
    const next = future[0];
    if (!next) {
      return null;
    }
    set({
      past: [...past, current],
      future: future.slice(1)
    });
    return next;
  },
  clear: () => set({ past: [], future: [] })
}));
