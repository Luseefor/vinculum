"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BottomPanelTab, ViewportMode } from "@/lib/types/ui";

interface EditorParameter {
  id: string;
  value: number;
  min: number;
  max: number;
}

export type EditorConstraintType = "attach" | "align" | "offset";

interface EditorConstraint {
  id: string;
  type: EditorConstraintType;
  objectIds: string[];
  enabled: boolean;
}

interface EditorAnimationState {
  parameterId: string | null;
  min: number;
  max: number;
  speed: number;
  loop: boolean;
  playing: boolean;
}

interface EditorStoreState {
  viewportMode: ViewportMode;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  bottomPanelCollapsed: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  bottomPanelHeight: number;
  leftPanelLastOpenWidth: number;
  rightPanelLastOpenWidth: number;
  bottomPanelLastOpenHeight: number;
  leftCollapseSnapOffset: number;
  rightCollapseSnapOffset: number;
  bottomCollapseSnapOffset: number;
  responsiveInspectorDrawer: boolean;
  responsiveLeftRail: boolean;
  responsiveBottomCollapsed: boolean;
  activeResizeHandle: "left" | "right" | "bottom" | null;
  resizePointerId: number | null;
  bottomPanelToggleSource: "manual" | "drag" | "breakpoint";
  bottomPanelTab: BottomPanelTab;
  parameters: EditorParameter[];
  consoleEvents: string[];
  constraints: EditorConstraint[];
  animation: EditorAnimationState;
  setViewportMode: (mode: ViewportMode) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
  setLeftPanelCollapsed: (collapsed: boolean) => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  setBottomPanelCollapsed: (collapsed: boolean) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setBottomPanelHeight: (height: number) => void;
  beginResize: (handle: "left" | "right" | "bottom", pointerId: number) => void;
  endResize: () => void;
  setResponsiveFlags: (flags: {
    inspectorDrawer?: boolean;
    leftRail?: boolean;
    bottomCollapsed?: boolean;
  }) => void;
  setBottomPanelToggleSource: (source: "manual" | "drag" | "breakpoint") => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
  setParameterValue: (id: string, value: number) => void;
  addConsoleEvent: (message: string) => void;
  addConstraint: (type: EditorConstraintType, objectIds: string[]) => void;
  toggleConstraint: (id: string) => void;
  removeConstraint: (id: string) => void;
  setAnimationParameterId: (id: string | null) => void;
  setAnimationRange: (min: number, max: number) => void;
  setAnimationSpeed: (speed: number) => void;
  toggleAnimationLoop: () => void;
  setAnimationPlaying: (playing: boolean) => void;
}

export const useEditorStore = create<EditorStoreState>()(
  persist(
    (set) => ({
      viewportMode: "split",
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      bottomPanelCollapsed: false,
      leftPanelWidth: 240,
      rightPanelWidth: 248,
      bottomPanelHeight: 160,
      leftPanelLastOpenWidth: 240,
      rightPanelLastOpenWidth: 248,
      bottomPanelLastOpenHeight: 160,
      leftCollapseSnapOffset: 40,
      rightCollapseSnapOffset: 40,
      bottomCollapseSnapOffset: 40,
      responsiveInspectorDrawer: false,
      responsiveLeftRail: false,
      responsiveBottomCollapsed: false,
      activeResizeHandle: null,
      resizePointerId: null,
      bottomPanelToggleSource: "manual",
      bottomPanelTab: "parameters",
      parameters: [
        { id: "r", value: 2.5, min: 0.1, max: 12 },
        { id: "h", value: 3.0, min: 0.1, max: 20 }
      ],
      consoleEvents: [],
      constraints: [],
      animation: {
        parameterId: "r",
        min: 0.1,
        max: 12,
        speed: 0.8,
        loop: true,
        playing: false
      },
      setViewportMode: (mode) => set({ viewportMode: mode }),
      toggleLeftPanel: () =>
        set((state) => ({
          leftPanelCollapsed: !state.leftPanelCollapsed,
          leftPanelLastOpenWidth: state.leftPanelCollapsed ? state.leftPanelLastOpenWidth : state.leftPanelWidth
        })),
      toggleRightPanel: () =>
        set((state) => ({
          rightPanelCollapsed: !state.rightPanelCollapsed,
          rightPanelLastOpenWidth: state.rightPanelCollapsed ? state.rightPanelLastOpenWidth : state.rightPanelWidth
        })),
      toggleBottomPanel: () =>
        set((state) => ({
          bottomPanelCollapsed: !state.bottomPanelCollapsed,
          bottomPanelLastOpenHeight: state.bottomPanelCollapsed ? state.bottomPanelLastOpenHeight : state.bottomPanelHeight,
          bottomPanelToggleSource: "manual"
        })),
      setLeftPanelCollapsed: (collapsed) => set({ leftPanelCollapsed: collapsed }),
      setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),
      setBottomPanelCollapsed: (collapsed) => set({ bottomPanelCollapsed: collapsed }),
      setLeftPanelWidth: (width) =>
        set((state) => {
          const next = clamp(width, 180, 420);
          return { leftPanelWidth: next, leftPanelLastOpenWidth: next, leftPanelCollapsed: false };
        }),
      setRightPanelWidth: (width) =>
        set((state) => {
          const next = clamp(width, 220, 540);
          return { rightPanelWidth: next, rightPanelLastOpenWidth: next, rightPanelCollapsed: false };
        }),
      setBottomPanelHeight: (height) =>
        set((state) => {
          const next = clamp(height, 96, 420);
          return { bottomPanelHeight: next, bottomPanelLastOpenHeight: next, bottomPanelCollapsed: false };
        }),
      beginResize: (handle, pointerId) => set({ activeResizeHandle: handle, resizePointerId: pointerId }),
      endResize: () => set({ activeResizeHandle: null, resizePointerId: null }),
      setResponsiveFlags: (flags) =>
        set((state) => ({
          responsiveInspectorDrawer: flags.inspectorDrawer ?? state.responsiveInspectorDrawer,
          responsiveLeftRail: flags.leftRail ?? state.responsiveLeftRail,
          responsiveBottomCollapsed: flags.bottomCollapsed ?? state.responsiveBottomCollapsed
        })),
      setBottomPanelToggleSource: (source) => set({ bottomPanelToggleSource: source }),
      setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),
      setParameterValue: (id, value) =>
        set((state) => ({
          parameters: state.parameters.map((parameter) =>
            parameter.id === id
              ? {
                  ...parameter,
                  value: clamp(value, parameter.min, parameter.max)
                }
              : parameter
          )
        })),
      addConsoleEvent: (message) =>
        set((state) => ({
          consoleEvents: [message, ...state.consoleEvents].slice(0, 80)
        })),
      addConstraint: (type, objectIds) =>
        set((state) => ({
          constraints: [
            ...state.constraints,
            {
              id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
              type,
              objectIds,
              enabled: true
            }
          ]
        })),
      toggleConstraint: (id) =>
        set((state) => ({
          constraints: state.constraints.map((constraint) =>
            constraint.id === id ? { ...constraint, enabled: !constraint.enabled } : constraint
          )
        })),
      removeConstraint: (id) =>
        set((state) => ({
          constraints: state.constraints.filter((constraint) => constraint.id !== id)
        })),
      setAnimationParameterId: (id) =>
        set((state) => ({
          animation: {
            ...state.animation,
            parameterId: id
          }
        })),
      setAnimationRange: (min, max) =>
        set((state) => ({
          animation: {
            ...state.animation,
            min: Math.min(min, max),
            max: Math.max(min, max)
          }
        })),
      setAnimationSpeed: (speed) =>
        set((state) => ({
          animation: {
            ...state.animation,
            speed: clamp(speed, 0.05, 8)
          }
        })),
      toggleAnimationLoop: () =>
        set((state) => ({
          animation: {
            ...state.animation,
            loop: !state.animation.loop
          }
        })),
      setAnimationPlaying: (playing) =>
        set((state) => ({
          animation: {
            ...state.animation,
            playing
          }
        }))
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
