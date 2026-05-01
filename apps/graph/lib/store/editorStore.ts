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
export type ConstraintAxis = "x" | "y" | "z";
export type ConstraintAxisLocks = Record<ConstraintAxis, boolean>;

const DEFAULT_AXIS_LOCKS: ConstraintAxisLocks = {
  x: true,
  y: true,
  z: true
};
const MIN_CONSTRAINT_OFFSET = -255;
const MAX_CONSTRAINT_OFFSET = 255;
const DEFAULT_OFFSET_VALUE = 28;

export interface EditorConstraint {
  id: string;
  type: EditorConstraintType;
  objectIds: string[];
  enabled: boolean;
  axisLocks: ConstraintAxisLocks;
  offsetValue: number;
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
  /** Optional performance HUD (FPS/frame-time) toggle. Off by default. */
  showPerfHud: boolean;
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
  updateConstraintAxisLocks: (id: string, axisLocks: Partial<ConstraintAxisLocks>) => void;
  updateConstraintOffsetValue: (id: string, offsetValue: number) => void;
  toggleConstraint: (id: string) => void;
  removeConstraint: (id: string) => void;
  setAnimationParameterId: (id: string | null) => void;
  setAnimationRange: (min: number, max: number) => void;
  setAnimationSpeed: (speed: number) => void;
  toggleAnimationLoop: () => void;
  setAnimationPlaying: (playing: boolean) => void;
  setShowPerfHud: (value: boolean) => void;
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
      showPerfHud: false,
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
        set((state) => {
          const [sourceId, targetId] = objectIds;
          if (!sourceId || !targetId || sourceId === targetId) {
            return state;
          }
          const exists = state.constraints.some(
            (constraint) =>
              constraint.type === type &&
              ((constraint.objectIds[0] === sourceId && constraint.objectIds[1] === targetId) ||
                (constraint.objectIds[0] === targetId && constraint.objectIds[1] === sourceId))
          );
          if (exists) {
            return state;
          }
          return {
            constraints: [
              ...state.constraints,
              {
                id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
                type,
                objectIds: [sourceId, targetId],
                enabled: true,
                axisLocks: { ...DEFAULT_AXIS_LOCKS },
                offsetValue: DEFAULT_OFFSET_VALUE
              }
            ]
          };
        }),
      updateConstraintAxisLocks: (id, axisLocks) =>
        set((state) => ({
          constraints: state.constraints.map((constraint) =>
            constraint.id !== id
              ? constraint
              : {
                  ...constraint,
                  axisLocks: sanitizeAxisLocks({
                    ...constraint.axisLocks,
                    ...axisLocks
                  })
                }
          )
        })),
      updateConstraintOffsetValue: (id, offsetValue) => {
        const safeOffset = sanitizeConstraintOffset(offsetValue);
        if (safeOffset === null) {
          return;
        }
        set((state) => ({
          constraints: state.constraints.map((constraint) =>
            constraint.id === id
              ? {
                  ...constraint,
                  offsetValue: safeOffset
                }
              : constraint
          )
        }));
      },
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
        set((state) => {
          if (!id) {
            return {
              animation: {
                ...state.animation,
                parameterId: null
              }
            };
          }

          const parameter = state.parameters.find((entry) => entry.id === id);
          if (!parameter) {
            return {
              animation: {
                ...state.animation,
                parameterId: id
              }
            };
          }

          return {
            animation: {
              ...state.animation,
              parameterId: id,
              min: parameter.min,
              max: parameter.max
            }
          };
        }),
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
        })),
      setShowPerfHud: (value) => set({ showPerfHud: value })
    }),
    {
      name: "vinculum-editor-layout",
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== "object") {
          return currentState;
        }
        const incoming = persistedState as Partial<EditorStoreState>;
        const incomingConstraints = Array.isArray(incoming.constraints) ? incoming.constraints : [];
        const normalizedConstraints = incomingConstraints.map((constraint) =>
          sanitizeConstraintRecord(constraint)
        );
        return {
          ...currentState,
          ...incoming,
          constraints: normalizedConstraints
        };
      }
    }
  )
);

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function sanitizeAxisLocks(value: unknown): ConstraintAxisLocks {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_AXIS_LOCKS };
  }
  const input = value as Partial<Record<ConstraintAxis, unknown>>;
  return {
    x: input.x !== false,
    y: input.y !== false,
    z: input.z !== false
  };
}

function sanitizeConstraintOffset(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return clamp(Math.round(value), MIN_CONSTRAINT_OFFSET, MAX_CONSTRAINT_OFFSET);
}

function sanitizeConstraintRecord(value: unknown): EditorConstraint {
  const input = (value && typeof value === "object" ? value : {}) as Partial<EditorConstraint>;
  const safeOffset = sanitizeConstraintOffset(input.offsetValue);
  return {
    id: typeof input.id === "string" ? input.id : `c_${Date.now().toString(36)}_legacy`,
    type: input.type === "attach" || input.type === "align" || input.type === "offset" ? input.type : "attach",
    objectIds: Array.isArray(input.objectIds)
      ? input.objectIds.filter((candidate): candidate is string => typeof candidate === "string").slice(0, 2)
      : [],
    enabled: input.enabled !== false,
    axisLocks: sanitizeAxisLocks(input.axisLocks),
    offsetValue: safeOffset ?? DEFAULT_OFFSET_VALUE
  };
}
