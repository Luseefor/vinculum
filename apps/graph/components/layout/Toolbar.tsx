"use client";

import { useState } from "react";
import NewSceneDialog from "@/components/layout/NewSceneDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/components/ui/styles";
import { MAX_VIEWPORT_SCALE, MIN_VIEWPORT_SCALE } from "@/lib/graph/viewport";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { useHistoryStore } from "@/lib/store/historyStore";
import { useGraphStore } from "@/store/graphStore";
import type { Canvas2DTool, Canvas3DTool } from "@/types/graphUi";

interface ToolbarProps {
  onOpenInspector?: () => void;
  leftCollapsed?: boolean;
  rightCollapsed?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  onDecreaseLeftWidth?: () => void;
  onIncreaseLeftWidth?: () => void;
  onDecreaseRightWidth?: () => void;
  onIncreaseRightWidth?: () => void;
}

export default function Toolbar({
  onOpenInspector,
  leftCollapsed = false,
  rightCollapsed = false,
  onToggleLeftPanel,
  onToggleRightPanel,
  onDecreaseLeftWidth,
  onIncreaseLeftWidth,
  onDecreaseRightWidth,
  onIncreaseRightWidth
}: ToolbarProps) {
  const [newSceneOpen, setNewSceneOpen] = useState(false);
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const resetScene = useGraphStore((state) => state.resetScene);
  const clearHistory = useHistoryStore((state) => state.clear);
  const openSceneDialog = useGraphStore((state) => state.openSceneDialog);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const setGraphMode = useGraphStore((state) => state.setGraphMode);
  const axis2dPair = useGraphStore((state) => state.ui.axis2dPair);
  const setAxis2DPair = useGraphStore((state) => state.setAxis2DPair);
  const themeMode = useGraphStore((state) => state.ui.themeMode);
  const setThemeMode = useGraphStore((state) => state.setThemeMode);
  const cycleThemeMode = useGraphStore((state) => state.cycleThemeMode);
  const viewport2d = useGraphStore((state) => state.ui.viewport2d);
  const updateViewport2D = useGraphStore((state) => state.updateViewport2D);
  const resetViewport2D = useGraphStore((state) => state.resetViewport2D);
  const canvas2dTool = useGraphStore((state) => state.ui.canvas2dTool);
  const setCanvas2dTool = useGraphStore((state) => state.setCanvas2dTool);
  const probePinnedMath = useGraphStore((state) => state.ui.probePinnedMath);
  const setProbePinnedMath = useGraphStore((state) => state.setProbePinnedMath);
  const sketchExtendFraction = useGraphStore((state) => state.ui.sketchExtendFraction);
  const sketchAutoCreate = useGraphStore((state) => state.ui.sketchAutoCreate);
  const setSketchExtendFraction = useGraphStore((state) => state.setSketchExtendFraction);
  const setSketchAutoCreate = useGraphStore((state) => state.setSketchAutoCreate);
  const canvas3dTool = useGraphStore((state) => state.ui.canvas3dTool);
  const setCanvas3dTool = useGraphStore((state) => state.setCanvas3dTool);
  const probePinnedWorld = useGraphStore((state) => state.ui.probePinnedWorld);
  const setProbePinnedWorld = useGraphStore((state) => state.setProbePinnedWorld);
  const resolvedTheme = useResolvedTheme();

  const handleResetView = () => {
    if (graphMode === "2d") {
      resetViewport2D();
    } else {
      requestCameraReset();
    }
  };

  const handleRequestNewScene = () => {
    if (objectCount === 0) {
      clearHistory();
      resetScene();
      return;
    }

    setNewSceneOpen(true);
  };

  const handleConfirmNewScene = () => {
    clearHistory();
    resetScene();
    setNewSceneOpen(false);
  };

  return (
    <>
      <NewSceneDialog
        open={newSceneOpen}
        onConfirm={handleConfirmNewScene}
        onCancel={() => setNewSceneOpen(false)}
      />
      <header className="relative z-40 flex min-h-12 flex-col gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="flex shrink-0 items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1">
            <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
            <h1 className="text-xs font-semibold tracking-[0.08em]">Vinculum</h1>
          </div>

          <div
            role="group"
            aria-label="Graph mode"
            className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1"
          >
            <button
              type="button"
              onClick={() => setGraphMode("2d")}
              aria-pressed={graphMode === "2d"}
              className={cn(
                "h-6 w-10 cursor-pointer rounded-md text-[10px] font-semibold transition-colors",
                graphMode === "2d"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-tertiary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-secondary)]"
              )}
            >
              2D
            </button>
            <button
              type="button"
              onClick={() => setGraphMode("3d")}
              aria-pressed={graphMode === "3d"}
              className={cn(
                "h-6 w-10 cursor-pointer rounded-md text-[10px] font-semibold transition-colors",
                graphMode === "3d"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-tertiary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-secondary)]"
              )}
            >
              3D
            </button>
          </div>

          <span className="shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[10px] text-[var(--text-tertiary)]">
            {objectCount} {objectCount === 1 ? "object" : "objects"}
          </span>

          {graphMode === "2d" && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1">
              <label className="text-[10px] text-[var(--text-tertiary)]">Axes</label>
              <select
                value={axis2dPair}
                onChange={(event) => {
                  const pair = event.target.value;
                  if (pair === "xy" || pair === "yz" || pair === "xz") {
                    setAxis2DPair(pair);
                  }
                }}
                className="h-6 rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-1.5 text-[10px] text-[var(--text-secondary)]"
                aria-label="2D axis pair"
              >
                <option value="xy">X / Y</option>
                <option value="yz">Y / Z</option>
                <option value="xz">X / Z</option>
              </select>
              <label className="text-[10px] text-[var(--text-tertiary)]">Scale</label>
              <input
                type="number"
                min={MIN_VIEWPORT_SCALE}
                max={MAX_VIEWPORT_SCALE}
                step="0.1"
                value={Number(viewport2d.scale.toPrecision(6))}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) {
                    updateViewport2D({ scale: next });
                  }
                }}
                className="h-6 w-16 rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-1.5 text-[10px] text-[var(--text-secondary)]"
                aria-label="2D axis scale"
              />

              <div
                role="group"
                aria-label="2D canvas tools"
                className="flex flex-wrap items-center gap-0.5 rounded border border-[var(--border-subtle)] p-0.5"
              >
                {(
                  [
                    { id: "pan", label: "Pan" },
                    { id: "probe", label: "Probe" },
                    { id: "draw", label: "Sketch" }
                  ] as { id: Canvas2DTool; label: string }[]
                ).map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    aria-pressed={canvas2dTool === tool.id}
                    onClick={() => setCanvas2dTool(tool.id)}
                    className={cn(
                      "h-6 rounded px-2 text-[10px] font-semibold transition-colors",
                      canvas2dTool === tool.id
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--text-tertiary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-secondary)]"
                    )}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>

              {canvas2dTool === "draw" && (
                <>
                  <label className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                    Extend
                    <Input
                      type="number"
                      min={0}
                      max={0.45}
                      step={0.05}
                      value={sketchExtendFraction}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isFinite(next)) {
                          setSketchExtendFraction(next);
                        }
                      }}
                      className="h-6 w-14 rounded border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-1 text-[10px] text-[var(--text-secondary)]"
                      title="Extrapolate fitted curve in parameter space: t ∈ [−extend, 1 + extend]"
                      aria-label="Sketch curve extension along parameter"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                    <input
                      type="checkbox"
                      checked={sketchAutoCreate}
                      onChange={(event) => setSketchAutoCreate(event.target.checked)}
                      aria-label="Auto create sketch fit"
                    />
                    Auto create
                  </label>
                </>
              )}

              {probePinnedMath && (
                <Button
                  type="button"
                  onClick={() => setProbePinnedMath(null)}
                  size="sm"
                  className="h-6"
                >
                  Clear pin
                </Button>
              )}
            </div>
          )}

          {graphMode === "3d" && (
            <div
              data-testid="toolbar-3d-tools"
              className="flex flex-wrap items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1"
            >
              <div
                role="group"
                aria-label="3D canvas tools"
                className="flex flex-wrap items-center gap-0.5 rounded border border-[var(--border-subtle)] p-0.5"
              >
                {(
                  [
                    { id: "pan", label: "Pan" },
                    { id: "probe", label: "Probe" },
                    { id: "draw", label: "Sketch" }
                  ] as { id: Canvas3DTool; label: string }[]
                ).map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    aria-pressed={canvas3dTool === tool.id}
                    onClick={() => setCanvas3dTool(tool.id)}
                    title={`3D tool: ${tool.label}`}
                    className={cn(
                      "h-6 rounded px-2 text-[10px] font-semibold transition-colors",
                      canvas3dTool === tool.id
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--text-tertiary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-secondary)]"
                    )}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>

              {canvas3dTool === "draw" && (
                <label className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                  Extend
                  <Input
                    type="number"
                    min={0}
                    max={0.45}
                    step={0.05}
                    value={sketchExtendFraction}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next)) {
                        setSketchExtendFraction(next);
                      }
                    }}
                    className="h-6 w-14 rounded border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-1 text-[10px] text-[var(--text-secondary)]"
                    title="Extrapolate fitted 3D curve in parameter space: t ∈ [−extend, 1 + extend]"
                    aria-label="3D sketch curve extension along parameter"
                  />
                </label>
              )}

              {probePinnedWorld && (
                <Button
                  type="button"
                  onClick={() => setProbePinnedWorld(null)}
                  size="sm"
                  className="h-6"
                >
                  Clear pin
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1">
            <select
              value={themeMode}
              onChange={(event) => {
                const mode = event.target.value;
                if (mode === "system" || mode === "light" || mode === "dark") {
                  setThemeMode(mode);
                }
              }}
              className="h-6 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-1.5 text-[10px] text-[var(--text-secondary)]"
              aria-label="Theme mode"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <Button
              type="button"
              onClick={cycleThemeMode}
              size="sm"
              className="h-6"
              title={`Theme: ${themeMode} (${resolvedTheme})`}
              aria-label={`Cycle theme mode, current ${themeMode}`}
            >
              {resolvedTheme === "dark" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1111.21 3c.2 0 .4.01.6.03A7 7 0 0021 12.79z" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              )}
            </Button>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1 lg:shrink-0 lg:justify-end">
          {onToggleLeftPanel ? (
            <Button type="button" variant="secondary" onClick={onToggleLeftPanel} aria-label="Toggle left sidebar">
              {leftCollapsed ? "Show left" : "Hide left"}
            </Button>
          ) : null}
          {!leftCollapsed && onDecreaseLeftWidth && onIncreaseLeftWidth ? (
            <div className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1">
              <span className="px-1 text-[10px] text-[var(--text-tertiary)]">Left</span>
              <Button type="button" size="sm" variant="ghost" onClick={onDecreaseLeftWidth} aria-label="Decrease left sidebar width">
                -
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onIncreaseLeftWidth} aria-label="Increase left sidebar width">
                +
              </Button>
            </div>
          ) : null}
          {onToggleRightPanel ? (
            <Button type="button" variant="secondary" onClick={onToggleRightPanel} aria-label="Toggle right sidebar">
              {rightCollapsed ? "Show right" : "Hide right"}
            </Button>
          ) : null}
          {!rightCollapsed && onDecreaseRightWidth && onIncreaseRightWidth ? (
            <div className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1">
              <span className="px-1 text-[10px] text-[var(--text-tertiary)]">Right</span>
              <Button type="button" size="sm" variant="ghost" onClick={onDecreaseRightWidth} aria-label="Decrease right sidebar width">
                -
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onIncreaseRightWidth} aria-label="Increase right sidebar width">
                +
              </Button>
            </div>
          ) : null}
          <Button type="button" onClick={handleRequestNewScene}>
            New
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          <Button type="button" onClick={() => openSceneDialog("import")}>
            Import
          </Button>
          <Button type="button" onClick={() => openSceneDialog("export")}>
            Export
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          <Button type="button" onClick={handleResetView}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            Reset
          </Button>
          {onOpenInspector ? (
            <Button type="button" className="lg:hidden" onClick={onOpenInspector}>
              Inspector
            </Button>
          ) : null}
        </nav>
      </header>
    </>
  );
}
