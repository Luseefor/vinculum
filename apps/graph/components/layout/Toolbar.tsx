"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import NewSceneDialog from "@/components/layout/NewSceneDialog";
import {
  ChevronDownIcon,
  MoonIcon,
  QuadViewIcon,
  RedoIcon,
  SingleViewIcon,
  SplitViewIcon,
  SunIcon,
  UndoIcon,
  VinculumMark
} from "@/components/layout/icons";
import { Button } from "@/components/ui/button";
import { Portal } from "@/components/ui/portal";
import { cn } from "@/components/ui/styles";
import { useHistoryStore } from "@/lib/store/historyStore";
import type { ViewportMode } from "@/lib/types/ui";
import { useGraphStore } from "@/store/graphStore";
import type { AccentPreset, Canvas2DTool, Canvas3DTool, ThemeMode, UiDensity } from "@/types/graphUi";

interface ToolbarProps {
  onOpenInspector?: () => void;
  leftCollapsed?: boolean;
  rightCollapsed?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  viewportMode?: ViewportMode;
  onViewportModeChange?: (mode: ViewportMode) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

const accentOptions: AccentPreset[] = ["indigo", "blue", "cyan", "emerald", "green", "amber", "orange", "rose", "pink", "violet"];
const accentHex: Record<AccentPreset, string> = {
  indigo: "#6366f1",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  emerald: "#10b981",
  green: "#22c55e",
  amber: "#f59e0b",
  orange: "#f97316",
  rose: "#f43f5e",
  pink: "#ec4899",
  violet: "#8b5cf6"
};

export default function Toolbar({
  onOpenInspector,
  viewportMode = "split",
  onViewportModeChange = () => undefined,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo
}: ToolbarProps) {
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [newSceneOpen, setNewSceneOpen] = useState(false);
  
  const appearanceTriggerRef = useRef<HTMLButtonElement>(null);
  const fileTriggerRef = useRef<HTMLButtonElement>(null);

  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const resetScene = useGraphStore((state) => state.resetScene);
  const openSceneDialog = useGraphStore((state) => state.openSceneDialog);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const setGraphMode = useGraphStore((state) => state.setGraphMode);
  const canvas2dTool = useGraphStore((state) => state.ui.canvas2dTool);
  const canvas3dTool = useGraphStore((state) => state.ui.canvas3dTool);
  const setCanvas2dTool = useGraphStore((state) => state.setCanvas2dTool);
  const setCanvas3dTool = useGraphStore((state) => state.setCanvas3dTool);
  const snapEnabled = useGraphStore((state) => state.ui.snapEnabled);
  const snapStep = useGraphStore((state) => state.ui.snapStep);
  const setSnapEnabled = useGraphStore((state) => state.setSnapEnabled);
  const setSnapStep = useGraphStore((state) => state.setSnapStep);
  const themeMode = useGraphStore((state) => state.ui.themeMode);
  const setThemeMode = useGraphStore((state) => state.setThemeMode);
  const accentPreset = useGraphStore((state) => state.ui.accentPreset);
  const setAccentPreset = useGraphStore((state) => state.setAccentPreset);
  const clearHistory = useHistoryStore((state) => state.clear);

  const activeTool = graphMode === "2d" ? canvas2dTool : canvas3dTool;

  const handleConfirmNewScene = () => {
    clearHistory();
    resetScene();
    setNewSceneOpen(false);
    setFileMenuOpen(false);
  };

  const setActiveTool = (tool: Canvas2DTool | Canvas3DTool) => {
    setCanvas2dTool(tool as Canvas2DTool);
    setCanvas3dTool(tool as Canvas3DTool);
  };

  // Close menus on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (appearanceOpen && !appearanceTriggerRef.current?.contains(e.target as Node)) {
        setAppearanceOpen(false);
      }
      if (fileMenuOpen && !fileTriggerRef.current?.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [appearanceOpen, fileMenuOpen]);

  return (
    <>
      <NewSceneDialog open={newSceneOpen} onConfirm={handleConfirmNewScene} onCancel={() => setNewSceneOpen(false)} />
      
      <header className="relative z-40 flex h-14 items-center gap-2 border-b border-[var(--panel-border)] bg-[var(--panel-bg)]/80 px-3 py-1.5 backdrop-blur-md">
        {/* Brand Pill */}
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] pl-1.5 pr-3 py-1 shadow-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-overlay)]">
            <VinculumMark className="h-4.5 w-4.5" />
          </div>
          <span className="text-xs font-bold tracking-tight text-[var(--text-primary)]">VINCULUM</span>
        </div>

        <div className="h-6 w-px shrink-0 bg-[var(--border-subtle)]/50" />

        {/* Mode & Tools Pill */}
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1 shadow-sm">
          <div className="flex items-center gap-0.5 px-1 mr-1 border-r border-[var(--border-subtle)]/40">
            <Button
              size="xs"
              variant={graphMode === "2d" ? "primary" : "ghost"}
              onClick={() => setGraphMode("2d")}
              className="rounded-full px-3"
            >
              2D
            </Button>
            <Button
              size="xs"
              variant={graphMode === "3d" ? "primary" : "ghost"}
              onClick={() => setGraphMode("3d")}
              className="rounded-full px-3"
            >
              3D
            </Button>
          </div>
          
          <div className="flex items-center gap-1 px-1">
            <Button
              size="xs"
              variant={activeTool === "pan" ? "primary" : "ghost"}
              onClick={() => setActiveTool("pan")}
              className="rounded-full"
            >
              Pan
            </Button>
            <Button
              size="xs"
              variant={activeTool === "probe" ? "primary" : "ghost"}
              onClick={() => setActiveTool("probe")}
              className="rounded-full"
            >
              Probe
            </Button>
            <Button
              size="xs"
              variant={activeTool === "draw" ? "primary" : "ghost"}
              onClick={() => setActiveTool("draw")}
              className="rounded-full"
            >
              Sketch
            </Button>
          </div>
        </div>

        {/* Snap & Utility Pill */}
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1 shadow-sm">
          <Button
            size="xs"
            variant={snapEnabled ? "primary" : "ghost"}
            onClick={() => setSnapEnabled(!snapEnabled)}
            className="rounded-full px-3"
          >
            Snap
          </Button>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--surface-overlay)]/40 border border-[var(--border-subtle)]/30">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)]">STEP</span>
            <input
              type="number"
              value={snapStep}
              onChange={(e) => setSnapStep(Number(e.target.value))}
              className="w-10 bg-transparent text-[11px] font-mono font-medium outline-none text-[var(--text-primary)]"
            />
          </div>
        </div>

        <div className="h-6 w-px shrink-0 bg-[var(--border-subtle)]/50" />

        {/* Viewport Control Pill */}
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1 shadow-sm">
          <Button
            size="icon"
            variant={viewportMode === "split" ? "primary" : "ghost"}
            onClick={() => onViewportModeChange("split")}
            className="h-7 w-7 rounded-full"
          >
            <SplitViewIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant={viewportMode === "2d" || viewportMode === "3d" ? "primary" : "ghost"}
            onClick={() => onViewportModeChange(graphMode)}
            className="h-7 w-7 rounded-full"
          >
            <SingleViewIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant={viewportMode === "quad" ? "primary" : "ghost"}
            onClick={() => onViewportModeChange("quad")}
            className="h-7 w-7 rounded-full"
          >
            <QuadViewIcon className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* History Pill */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1 shadow-sm">
          <Button
            size="icon"
            variant="shell"
            onClick={onUndo}
            disabled={!canUndo}
            className="h-7 w-7 rounded-full"
          >
            <UndoIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="shell"
            onClick={onRedo}
            disabled={!canRedo}
            className="h-7 w-7 rounded-full"
          >
            <RedoIcon className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1" />

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <Button
            ref={fileTriggerRef}
            variant="utility"
            size="sm"
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            className="rounded-full gap-2 px-4 shadow-sm"
          >
            Scene
            <ChevronDownIcon className={cn("h-3 w-3 transition-transform", fileMenuOpen && "rotate-180")} />
          </Button>

          <Button
            ref={appearanceTriggerRef}
            variant="utility"
            size="icon"
            onClick={() => setAppearanceOpen(!appearanceOpen)}
            className="h-8 w-8 rounded-full shadow-sm"
          >
            {themeMode === "dark" ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
          </Button>
        </div>

        {/* File Dropdown Portal */}
        {fileMenuOpen && (
          <Portal>
            <div 
              className="fixed z-[100] w-48 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]/95 shadow-2xl backdrop-blur-xl"
              style={{
                top: (fileTriggerRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
                left: (fileTriggerRef.current?.getBoundingClientRect().left ?? 0) - 40
              }}
            >
              <div className="p-1.5 flex flex-col gap-0.5">
                <MenuButton onClick={() => { if(objectCount === 0) resetScene(); else setNewSceneOpen(true); setFileMenuOpen(false); }}>New Scene</MenuButton>
                <MenuButton onClick={() => { openSceneDialog("import"); setFileMenuOpen(false); }}>Import...</MenuButton>
                <MenuButton onClick={() => { openSceneDialog("export"); setFileMenuOpen(false); }}>Export...</MenuButton>
                <div className="h-px bg-[var(--border-subtle)]/40 my-1 mx-2" />
                <MenuButton onClick={() => { requestCameraReset(); setFileMenuOpen(false); }}>Reset Camera</MenuButton>
              </div>
            </div>
          </Portal>
        )}

        {/* Appearance Dropdown Portal */}
        {appearanceOpen && (
          <Portal>
            <div 
              className="fixed z-[100] w-64 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]/95 shadow-2xl backdrop-blur-xl"
              style={{
                top: (appearanceTriggerRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
                right: window.innerWidth - (appearanceTriggerRef.current?.getBoundingClientRect().right ?? 0)
              }}
            >
              <div className="p-4 flex flex-col gap-6">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)] mb-3">Appearance</h3>
                  <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)]/40">
                    <button 
                      onClick={() => setThemeMode("light")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 h-7 rounded-full text-[11px] font-medium transition",
                        themeMode === "light" ? "bg-[var(--surface-overlay)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      )}
                    >
                      <SunIcon className="h-3.5 w-3.5" /> Light
                    </button>
                    <button 
                      onClick={() => setThemeMode("dark")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 h-7 rounded-full text-[11px] font-medium transition",
                        themeMode === "dark" ? "bg-[var(--surface-overlay)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      )}
                    >
                      <MoonIcon className="h-3.5 w-3.5" /> Dark
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)] mb-3">Accent Color</h3>
                  <div className="grid grid-cols-5 gap-3 justify-items-center">
                    {accentOptions.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setAccentPreset(preset)}
                        className={cn(
                          "h-5 w-5 rounded-full border-2 transition hover:scale-125 active:scale-95",
                          accentPreset === preset ? "border-[var(--text-primary)] ring-2 ring-[var(--accent-primary)]/20" : "border-transparent"
                        )}
                        style={{ backgroundColor: accentHex[preset] }}
                        aria-label={`Accent ${preset}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Portal>
        )}
      </header>
    </>
  );
}

function MenuButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center px-3 py-2 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)]/60 rounded-lg transition-colors"
    >
      {children}
    </button>
  );
}
