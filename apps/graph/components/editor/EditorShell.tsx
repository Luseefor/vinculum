"use client";

import GraphViewportErrorBoundary from "@/components/graph/GraphViewportErrorBoundary";
import BottomPanel from "@/components/editor/BottomPanel";
import CommandPalette from "@/components/editor/CommandPalette";
import ContextMenu from "@/components/editor/ContextMenu";
import LeftObjectBrowser from "@/components/editor/LeftObjectBrowser";
import RightInspector from "@/components/editor/RightInspector";
import StatusBar from "@/components/editor/StatusBar";
import TopToolbar from "@/components/editor/TopToolbar";
import SceneImportExportDialog from "@/components/scene/SceneImportExportDialog";
import ThemeSync from "@/components/theme/ThemeSync";
import { Sheet } from "@/components/ui/sheet";
import ViewportHost from "@/components/viewport/ViewportHost";
import Viewport2D from "@/components/viewport/Viewport2D";
import Viewport3D from "@/components/viewport/Viewport3D";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { serializeScene } from "@/lib/scene/serializeScene";
import { getCurrentSceneSnapshot } from "@/lib/store/sceneStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import type { SceneSnapshot } from "@/lib/types/scene";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/components/ui/styles";
import { applyConstraintDerivedUpdates } from "@/lib/editor/applyConstraintDerivedUpdates";

export default function EditorShell() {
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const setGraphMode = useGraphStore((state) => state.setGraphMode);
  const axis2dPair = useGraphStore((state) => state.ui.axis2dPair);
  const axis2dPairQuadTop = useGraphStore((state) => state.ui.axis2dPairQuadTop);
  const active2dViewport = useGraphStore((state) => state.ui.active2dViewport);
  const setAxis2DPair = useGraphStore((state) => state.setAxis2DPair);
  const setActive2dViewport = useGraphStore((state) => state.setActive2dViewport);
  const canvas2dTool = useGraphStore((state) => state.ui.canvas2dTool);
  const canvas3dTool = useGraphStore((state) => state.ui.canvas3dTool);
  const baseline3dPlane = useGraphStore((state) => state.ui.baseline3dPlane);
  const setCanvas2dTool = useGraphStore((state) => state.setCanvas2dTool);
  const setCanvas3dTool = useGraphStore((state) => state.setCanvas3dTool);
  const setBaseline3dPlane = useGraphStore((state) => state.setBaseline3dPlane);
  const snapEnabled = useGraphStore((state) => state.ui.snapEnabled);
  const snapStep = useGraphStore((state) => state.ui.snapStep);
  const setSnapEnabled = useGraphStore((state) => state.setSnapEnabled);
  const updateObjectColor = useGraphStore((state) => state.updateObjectColor);
  const setObjectVisibility = useGraphStore((state) => state.setObjectVisibility);
  const viewport2d = useGraphStore((state) => state.ui.viewport2d);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const removeObject = useGraphStore((state) => state.removeObject);
  const applySceneSnapshot = useGraphStore((state) => state.applySceneSnapshot);
  const replaceSceneDocument = useGraphStore((state) => state.replaceSceneDocument);
  const scene = useGraphStore((state) => state.scene);
  const resetViewport2D = useGraphStore((state) => state.resetViewport2D);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);
  const addSurfaceObject = useGraphStore((state) => state.addSurfaceObject);
  const addParametricCurve = useGraphStore((state) => state.addParametricCurve);
  const addPlaneObject = useGraphStore((state) => state.addPlaneObject);

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0
  });

  const importInputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const leftCollapsed = useEditorStore((state) => state.leftPanelCollapsed);
  const rightCollapsed = useEditorStore((state) => state.rightPanelCollapsed);
  const leftWidth = useEditorStore((state) => state.leftPanelWidth);
  const rightWidth = useEditorStore((state) => state.rightPanelWidth);
  const toggleLeftPanel = useEditorStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useEditorStore((state) => state.toggleRightPanel);
  const setLeftPanelWidth = useEditorStore((state) => state.setLeftPanelWidth);
  const setRightPanelWidth = useEditorStore((state) => state.setRightPanelWidth);
  const setLeftPanelCollapsed = useEditorStore((state) => state.setLeftPanelCollapsed);
  const setRightPanelCollapsed = useEditorStore((state) => state.setRightPanelCollapsed);
  const setBottomPanelCollapsed = useEditorStore((state) => state.setBottomPanelCollapsed);
  const setBottomPanelHeight = useEditorStore((state) => state.setBottomPanelHeight);
  const bottomPanelHeight = useEditorStore((state) => state.bottomPanelHeight);
  const bottomPanelCollapsed = useEditorStore((state) => state.bottomPanelCollapsed);
  const leftCollapseSnapOffset = useEditorStore((state) => state.leftCollapseSnapOffset);
  const rightCollapseSnapOffset = useEditorStore((state) => state.rightCollapseSnapOffset);
  const bottomCollapseSnapOffset = useEditorStore((state) => state.bottomCollapseSnapOffset);
  const beginResize = useEditorStore((state) => state.beginResize);
  const endResize = useEditorStore((state) => state.endResize);
  const setResponsiveFlags = useEditorStore((state) => state.setResponsiveFlags);
  const viewportMode = useEditorStore((state) => state.viewportMode);
  const setViewportMode = useEditorStore((state) => state.setViewportMode);
  const addConsoleEvent = useEditorStore((state) => state.addConsoleEvent);
  const constraints = useEditorStore((state) => state.constraints);
  const pushSnapshot = useHistoryStore((state) => state.pushSnapshot);
  const undoHistory = useHistoryStore((state) => state.undo);
  const redoHistory = useHistoryStore((state) => state.redo);
  const clearHistory = useHistoryStore((state) => state.clear);
  const canUndo = useHistoryStore((state) => state.past.length > 0);
  const canRedo = useHistoryStore((state) => state.future.length > 0);
  
  const historyActionRef = useRef(false);
  const skipDerivedHistoryRef = useRef(0);
  const lastSceneSnapshotRef = useRef<SceneSnapshot | null>(null);
  const effectiveViewportMode = viewportMode === "split" || viewportMode === "quad" ? viewportMode : graphMode;
  const primary2dPlaneLabel = useMemo(() => {
    if (axis2dPair === "xy") {
      return "XY";
    }
    if (axis2dPair === "xz") {
      return "XZ";
    }
    return "YZ";
  }, [axis2dPair]);
  const planeSwitcherActivePair =
    effectiveViewportMode === "quad" && active2dViewport === "quadTop" ? axis2dPairQuadTop : axis2dPair;
  const selectedLabel = selectedObjectId ? selectedObjectId.slice(0, 8) : "None";
  const zoomLabel = graphMode === "2d" ? `${Math.round(viewport2d.scale)}%` : "Perspective";
  const snapLabel = snapEnabled ? `ON (${snapStep})` : "OFF";
  const [inspectorDrawerMode, setInspectorDrawerMode] = useState(false);

  const activeTool = graphMode === "2d" ? canvas2dTool : canvas3dTool;
  const setActiveTool = (tool: any) => {
    setCanvas2dTool(tool);
    setCanvas3dTool(tool);
  };

  const runUndo = useCallback(() => {
    const current = getCurrentSceneSnapshot();
    const previous = undoHistory(current);
    if (!previous) return;
    historyActionRef.current = true;
    applySceneSnapshot(previous);
    addConsoleEvent("Undo");
  }, [addConsoleEvent, applySceneSnapshot, undoHistory]);

  const runRedo = useCallback(() => {
    const current = getCurrentSceneSnapshot();
    const next = redoHistory(current);
    if (!next) return;
    historyActionRef.current = true;
    applySceneSnapshot(next);
    addConsoleEvent("Redo");
  }, [addConsoleEvent, applySceneSnapshot, redoHistory]);

  const runCommand = useCallback((commandId: string) => {
    if (commandId === "undo") { runUndo(); return; }
    if (commandId === "redo") { runRedo(); return; }
    if (commandId === "toggle-2d") { setGraphMode("2d"); setViewportMode("2d"); return; }
    if (commandId === "toggle-3d") { setGraphMode("3d"); setViewportMode("3d"); return; }
    if (commandId === "switch-split") { setViewportMode("split"); return; }
    if (commandId === "switch-quad") { setViewportMode("quad"); return; }
  }, [runUndo, runRedo, setGraphMode, setViewportMode]);

  useEffect(() => {
    const currentSnapshot = getCurrentSceneSnapshot();
    const previousSnapshot = lastSceneSnapshotRef.current;

    if (!previousSnapshot) {
      lastSceneSnapshotRef.current = currentSnapshot;
      return;
    }

    if (historyActionRef.current) {
      historyActionRef.current = false;
      lastSceneSnapshotRef.current = currentSnapshot;
      return;
    }

    const objectsChanged = previousSnapshot.objects !== currentSnapshot.objects;
    const selectionChanged =
      previousSnapshot.selection.selectedObjectId !== currentSnapshot.selection.selectedObjectId;

    if (objectsChanged && skipDerivedHistoryRef.current > 0) {
      skipDerivedHistoryRef.current -= 1;
      lastSceneSnapshotRef.current = currentSnapshot;
      return;
    }

    if (objectsChanged || selectionChanged) {
      pushSnapshot(previousSnapshot);
    }

    lastSceneSnapshotRef.current = currentSnapshot;
  }, [pushSnapshot, scene.objects, selectedObjectId]);

  useEffect(() => {
    if (constraints.length === 0 || scene.objects.length === 0) {
      return;
    }

    const derivedUpdateCount = applyConstraintDerivedUpdates(
      constraints,
      setObjectVisibility,
      updateObjectColor
    );
    if (derivedUpdateCount > 0) {
      skipDerivedHistoryRef.current += derivedUpdateCount;
    }
  }, [constraints, scene.objects, setObjectVisibility, updateObjectColor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
        setContextMenu((state) => ({ ...state, open: false }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const node = shellRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? window.innerWidth;
      const inspectorDrawer = width <= 1100;
      setInspectorDrawerMode(inspectorDrawer);
      setResponsiveFlags({ inspectorDrawer, leftRail: false, bottomCollapsed: false });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [setResponsiveFlags]);

  useEffect(() => {
    if (effectiveViewportMode !== "quad") {
      setActive2dViewport("primary");
    }
  }, [effectiveViewportMode, setActive2dViewport]);

  const startHorizontalResize = useCallback((event: ReactPointerEvent<HTMLDivElement>, side: "left" | "right") => {
    const shell = shellRef.current;
    if (!shell) return;
    const divider = event.currentTarget;
    divider.setPointerCapture(event.pointerId);
    beginResize(side, event.pointerId);
    const bounds = shell.getBoundingClientRect();
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const onMove = (moveEvent: PointerEvent) => {
      const x = moveEvent.clientX - bounds.left;
      const maxLeftWidth = Math.min(420, Math.floor(bounds.width * 0.45));
      const maxRightWidth = Math.min(540, Math.floor(bounds.width * 0.45));
      if (side === "left") {
        if (x <= leftCollapseSnapOffset) { setLeftPanelCollapsed(true); return; }
        setLeftPanelCollapsed(false);
        setLeftPanelWidth(clamp(x, 180, Math.max(180, maxLeftWidth)));
      } else {
        const nextWidth = bounds.right - moveEvent.clientX;
        if (nextWidth <= rightCollapseSnapOffset) { setRightPanelCollapsed(true); return; }
        setRightPanelCollapsed(false);
        setRightPanelWidth(clamp(nextWidth, 220, Math.max(220, maxRightWidth)));
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      if (divider.hasPointerCapture(event.pointerId)) {
        divider.releasePointerCapture(event.pointerId);
      }
      endResize();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [beginResize, endResize, leftCollapseSnapOffset, rightCollapseSnapOffset, setLeftPanelCollapsed, setLeftPanelWidth, setRightPanelCollapsed, setRightPanelWidth]);

  const startBottomResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const shell = shellRef.current;
    if (!shell) return;
    beginResize("bottom", event.pointerId);
    const bounds = shell.getBoundingClientRect();
    const onMove = (moveEvent: PointerEvent) => {
      const nextHeight = bounds.bottom - moveEvent.clientY - 24;
      if (nextHeight <= bottomCollapseSnapOffset) { setBottomPanelCollapsed(true); return; }
      setBottomPanelCollapsed(false);
      setBottomPanelHeight(nextHeight);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      endResize();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [beginResize, bottomCollapseSnapOffset, endResize, setBottomPanelCollapsed, setBottomPanelHeight]);

  return (
    <div
      ref={shellRef}
      className="flex h-screen flex-col overflow-hidden bg-[var(--bg-primary)] font-sans"
      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ open: true, x: e.clientX, y: e.clientY }); }}
    >
      <ThemeSync />
      <TopToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={runUndo}
        onRedo={runRedo}
      />
      
      <div className="flex min-h-0 flex-1">
        {!leftCollapsed && (
          <>
            <LeftObjectBrowser width={leftWidth} />
            <div className="divider-x" onPointerDown={(e) => startHorizontalResize(e, "left")} />
          </>
        )}

        <main className="relative flex min-w-0 flex-1 flex-col bg-[var(--surface-canvas)]">
          <div className="flex items-center justify-between border-b border-[var(--panel-border)] bg-[var(--bg-tertiary)] px-3 py-1.5 shrink-0 overflow-x-auto">
            <div className="flex items-center gap-4">
              {/* Graph Mode (2D/3D) */}
              <div className="flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] p-0.5 shadow-sm shrink-0">
                <button
                  type="button"
                  aria-pressed={graphMode === "2d"}
                  onClick={() => setGraphMode("2d")}
                  className={cn(
                    "h-6 rounded-full px-3 text-[9px] font-bold uppercase tracking-wider transition-all",
                    graphMode === "2d" ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  )}
                >
                  2D
                </button>
                <button
                  type="button"
                  aria-pressed={graphMode === "3d"}
                  onClick={() => setGraphMode("3d")}
                  className={cn(
                    "h-6 rounded-full px-3 text-[9px] font-bold uppercase tracking-wider transition-all",
                    graphMode === "3d" ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  )}
                >
                  3D
                </button>
              </div>

              {/* Axis Plane Switcher (Visible only in 2D or Split mode) */}
              {(graphMode === "2d" || effectiveViewportMode === "split" || effectiveViewportMode === "quad") && (
                <>
                  <div className="w-px h-4 bg-[var(--border-strong)] shrink-0" />
                  <div
                    className="flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] p-0.5 shadow-sm shrink-0"
                    title={
                      effectiveViewportMode === "quad"
                        ? "Plane applies to the 2D view you last clicked or zoomed."
                        : undefined
                    }
                  >
                    {(["xy", "xz", "yz"] as const).map((pair) => (
                      <button
                        key={pair}
                        onClick={() => setAxis2DPair(pair)}
                        className={cn(
                          "h-6 rounded-full px-3 text-[9px] font-bold uppercase tracking-wider transition-all",
                          planeSwitcherActivePair === pair
                            ? "bg-[var(--accent)] text-white shadow-sm"
                            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                        )}
                      >
                        {pair}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* 3D Baseline Plane Switcher */}
              {(graphMode === "3d" || effectiveViewportMode === "split" || effectiveViewportMode === "quad") && (
                <>
                  <div className="w-px h-4 bg-[var(--border-strong)] shrink-0" />
                  <div
                    className="flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] p-0.5 shadow-sm shrink-0"
                    title="Baseline plane for the 3D grid and sketch/probe plane picking."
                  >
                    {(["xy", "xz", "yz"] as const).map((pair) => (
                      <button
                        key={pair}
                        onClick={() => setBaseline3dPlane(pair)}
                        className={cn(
                          "h-6 rounded-full px-3 text-[9px] font-bold uppercase tracking-wider transition-all",
                          baseline3dPlane === pair
                            ? "bg-[var(--accent)] text-white shadow-sm"
                            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                        )}
                      >
                        Base {pair}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="w-px h-4 bg-[var(--border-strong)] shrink-0" />

              {/* Viewport Switcher */}
              <div className="flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] p-0.5 shadow-sm shrink-0">
                {(["split", "quad"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewportMode(mode)}
                    className={cn(
                      "h-6 rounded-full px-3 text-[9px] font-bold uppercase tracking-wider transition-all",
                      effectiveViewportMode === mode
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                    )}
                  >
                    {mode}
                  </button>
                ))}
                <button
                  onClick={() => setViewportMode(graphMode)}
                  className={cn(
                    "h-6 rounded-full px-3 text-[9px] font-bold uppercase tracking-wider transition-all",
                    effectiveViewportMode === "2d" || effectiveViewportMode === "3d"
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  )}
                >
                  Single
                </button>
              </div>

              <div className="w-px h-4 bg-[var(--border-strong)] shrink-0" />

              {/* Tools Switcher */}
              <div className="flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] p-0.5 shadow-sm shrink-0">
                {(["pan", "probe", "draw"] as const).map((tool) => (
                  <button
                    key={tool}
                    onClick={() => setActiveTool(tool)}
                    className={cn(
                      "h-6 rounded-full px-3 text-[9px] font-bold uppercase tracking-wider transition-all",
                      activeTool === tool
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                    )}
                  >
                    {tool === "draw" ? "Sketch" : tool}
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => setInspectorOpen(true)}
              className="lg:hidden text-[9px] font-bold uppercase tracking-widest text-[var(--accent)] hover:underline ml-4"
            >
              Inspector
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            <GraphViewportErrorBoundary>
              <ViewportHost
                mode={effectiveViewportMode}
                viewport2d={<Viewport2D key="graph-2d" />}
                viewport2dQuadTop={<Viewport2D key="graph-2d-quad-xz" variant="quadTop" />}
                primary2dPlaneLabel={primary2dPlaneLabel}
                secondary2dPlaneTitle={axis2dPairQuadTop.toUpperCase()}
                viewport3d={<Viewport3D key="graph-3d" />}
                selectedLabel={selectedLabel}
                zoomLabel={zoomLabel}
                snapLabel={snapLabel}
              />
            </GraphViewportErrorBoundary>
          </div>
        </main>

        {!inspectorDrawerMode && !rightCollapsed && (
          <>
            <div className="divider-x" onPointerDown={(e) => startHorizontalResize(e, "right")} />
            <RightInspector width={rightWidth} />
          </>
        )}
      </div>

      <div className="divider-y" onPointerDown={startBottomResize} />
      <BottomPanel height={bottomPanelCollapsed ? 0 : bottomPanelHeight} />
      
      <StatusBar />
      <SceneImportExportDialog />
      <Sheet open={inspectorOpen || (inspectorDrawerMode && !rightCollapsed)} onOpenChange={setInspectorOpen} title="Inspector">
        <RightInspector width={rightWidth} />
      </Sheet>
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} onRunCommand={runCommand} />
      <ContextMenu open={contextMenu.open} x={contextMenu.x} y={contextMenu.y} onRunCommand={runCommand} hasSelection={Boolean(selectedObjectId)} canUndo={canUndo} canRedo={canRedo} snapEnabled={snapEnabled} currentMode={effectiveViewportMode} onClose={() => setContextMenu(state => ({ ...state, open: false }))} />
      
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const parsed = deserializeScene(text);
          if (parsed.valid && parsed.normalizedScene) {
            clearHistory();
            replaceSceneDocument(parsed.normalizedScene);
            addConsoleEvent("Imported scene JSON");
          }
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
