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

export const useHistoryStore = create<HistoryStoreState>((set, get) => ({
  past: [],
  future: [],
  pushSnapshot: (snapshot) => {
    set((state) => ({
      past: [...state.past, snapshot],
      future: []
    }));
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
