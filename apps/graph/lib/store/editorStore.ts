"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BottomPanelTab, ViewportMode } from "@/lib/types/ui";

interface EditorStoreState {
  viewportMode: ViewportMode;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  bottomPanelCollapsed: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  bottomPanelHeight: number;
  bottomPanelTab: BottomPanelTab;
  setViewportMode: (mode: ViewportMode) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setBottomPanelHeight: (height: number) => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
}

export const useEditorStore = create<EditorStoreState>()(
  persist(
    (set) => ({
      viewportMode: "3d",
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      bottomPanelCollapsed: false,
      leftPanelWidth: 280,
      rightPanelWidth: 320,
      bottomPanelHeight: 180,
      bottomPanelTab: "parameters",
      setViewportMode: (mode) => set({ viewportMode: mode }),
      toggleLeftPanel: () => set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
      toggleRightPanel: () => set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
      toggleBottomPanel: () => set((state) => ({ bottomPanelCollapsed: !state.bottomPanelCollapsed })),
      setLeftPanelWidth: (width) => set({ leftPanelWidth: clamp(width, 224, 480) }),
      setRightPanelWidth: (width) => set({ rightPanelWidth: clamp(width, 260, 540) }),
      setBottomPanelHeight: (height) => set({ bottomPanelHeight: clamp(height, 120, 360) }),
      setBottomPanelTab: (tab) => set({ bottomPanelTab: tab })
    }),
    {
      name: "vinculum-editor-layout"
    }
  )
);

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
