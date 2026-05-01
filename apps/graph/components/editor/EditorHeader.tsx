"use client";

import TopToolbar from "@/components/editor/TopToolbar";
import type { Axis2DPair } from "@/types/graphUi";

interface EditorHeaderProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenWelcome: () => void;
  openExamplesSignal?: number;
  activeViewType: "2d" | "3d" | "both";
  onViewTypeChange: (view: "2d" | "3d" | "both") => void;
  activeLayout: "split" | "quad";
  onLayoutChange: (layout: "split" | "quad") => void;
  plane2d: Axis2DPair;
  onPlane2dChange: (pair: Axis2DPair) => void;
  base3d: Axis2DPair;
  onBase3dChange: (pair: Axis2DPair) => void;
  activeToolLabel: "select" | "pan" | "probe" | "addPin" | "measureDistance" | "measureAngle" | "draw";
  onToolChange: (tool: "select" | "pan" | "probe" | "addPin" | "measureDistance" | "measureAngle" | "draw") => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}

export default function EditorHeader(props: EditorHeaderProps) {
  return <TopToolbar {...props} />;
}
