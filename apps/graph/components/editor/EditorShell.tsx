"use client";

import GraphViewportErrorBoundary from "@/components/graph/GraphViewportErrorBoundary";
import BottomPanel from "@/components/editor/BottomPanel";
import CommandPalette from "@/components/editor/CommandPalette";
import ContextMenu from "@/components/editor/ContextMenu";
import FloatingToolHUD from "@/components/editor/FloatingToolHUD";
import LeftObjectBrowser from "@/components/editor/LeftObjectBrowser";
import RightInspector from "@/components/editor/RightInspector";
import StatusBar from "@/components/editor/StatusBar";
import TopToolbar from "@/components/editor/TopToolbar";
import SceneImportExportDialog from "@/components/scene/SceneImportExportDialog";
import ThemeSync from "@/components/theme/ThemeSync";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import Viewport2D from "@/components/viewport/Viewport2D";
import Viewport3D from "@/components/viewport/Viewport3D";
import ViewportHost from "@/components/viewport/ViewportHost";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { serializeScene } from "@/lib/scene/serializeScene";
import { getCurrentSceneSnapshot } from "@/lib/store/sceneStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";
import { useCallback, useEffect, useRef, useState } from "react";

export default function EditorShell() {
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const addSurfaceObject = useGraphStore((state) => state.addSurfaceObject);
  const addParametricCurve = useGraphStore((state) => state.addParametricCurve);
  const addPlaneObject = useGraphStore((state) => state.addPlaneObject);
  const setGraphMode = useGraphStore((state) => state.setGraphMode);
  const setCanvas2dTool = useGraphStore((state) => state.setCanvas2dTool);
  const setCanvas3dTool = useGraphStore((state) => state.setCanvas3dTool);
  const canvas2dTool = useGraphStore((state) => state.ui.canvas2dTool);
  const canvas3dTool = useGraphStore((state) => state.ui.canvas3dTool);
  const viewport2d = useGraphStore((state) => state.ui.viewport2d);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const removeObject = useGraphStore((state) => state.removeObject);
  const applySceneSnapshot = useGraphStore((state) => state.applySceneSnapshot);
  const replaceSceneDocument = useGraphStore((state) => state.replaceSceneDocument);
  const scene = useGraphStore((state) => state.scene);
  const resetViewport2D = useGraphStore((state) => state.resetViewport2D);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0
  });
  const importInputRef = useRef<HTMLInputElement>(null);
  const leftCollapsed = useEditorStore((state) => state.leftPanelCollapsed);
  const rightCollapsed = useEditorStore((state) => state.rightPanelCollapsed);
  const leftWidth = useEditorStore((state) => state.leftPanelWidth);
  const rightWidth = useEditorStore((state) => state.rightPanelWidth);
  const toggleLeftPanel = useEditorStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useEditorStore((state) => state.toggleRightPanel);
  const setLeftPanelWidth = useEditorStore((state) => state.setLeftPanelWidth);
  const setRightPanelWidth = useEditorStore((state) => state.setRightPanelWidth);
  const viewportMode = useEditorStore((state) => state.viewportMode);
  const setViewportMode = useEditorStore((state) => state.setViewportMode);
  const addConsoleEvent = useEditorStore((state) => state.addConsoleEvent);
  const pushSnapshot = useHistoryStore((state) => state.pushSnapshot);
  const undoHistory = useHistoryStore((state) => state.undo);
  const redoHistory = useHistoryStore((state) => state.redo);
  const clearHistory = useHistoryStore((state) => state.clear);
  const canUndo = useHistoryStore((state) => state.past.length > 0);
  const canRedo = useHistoryStore((state) => state.future.length > 0);
  const prevSnapshotRef = useRef(getCurrentSceneSnapshot());
  const historyActionRef = useRef(false);
  const effectiveViewportMode = viewportMode === "split" || viewportMode === "quad" ? viewportMode : graphMode;
  const selectedLabel = selectedObjectId ? selectedObjectId.slice(0, 8) : "None";
  const primaryToolLabel = canvas2dTool.toUpperCase();
  const secondaryToolLabel = canvas3dTool.toUpperCase();
  const zoomLabel = graphMode === "2d" ? `Zoom ${Math.round(viewport2d.scale)}%` : "Perspective";
  const snapLabel = "Grid";

  const runUndo = useCallback(() => {
    const current = getCurrentSceneSnapshot();
    const previous = undoHistory(current);
    if (!previous) {
      return;
    }
    historyActionRef.current = true;
    applySceneSnapshot(previous);
    addConsoleEvent("Undo");
  }, [addConsoleEvent, applySceneSnapshot, undoHistory]);

  const runRedo = useCallback(() => {
    const current = getCurrentSceneSnapshot();
    const next = redoHistory(current);
    if (!next) {
      return;
    }
    historyActionRef.current = true;
    applySceneSnapshot(next);
    addConsoleEvent("Redo");
  }, [addConsoleEvent, applySceneSnapshot, redoHistory]);

  const runCommand = useCallback(
    (commandId: string) => {
      if (commandId === "add-surface") {
        addSurfaceObject();
        addConsoleEvent("Created surface object");
        return;
      }
      if (commandId === "add-curve") {
        addParametricCurve();
        addConsoleEvent("Created parametric curve");
        return;
      }
      if (commandId === "add-plane") {
        addPlaneObject();
        addConsoleEvent("Created plane object");
        return;
      }
      if (commandId === "toggle-2d") {
        setGraphMode("2d");
        setViewportMode("2d");
        addConsoleEvent("Switched viewport to 2D");
        return;
      }
      if (commandId === "toggle-3d") {
        setGraphMode("3d");
        setViewportMode("3d");
        addConsoleEvent("Switched viewport to 3D");
        return;
      }
      if (commandId === "switch-split") {
        setViewportMode("split");
        addConsoleEvent("Switched viewport to Split");
        return;
      }
      if (commandId === "switch-quad") {
        setViewportMode("quad");
        addConsoleEvent("Switched viewport to Quad");
        return;
      }
      if (commandId === "undo") {
        runUndo();
        return;
      }
      if (commandId === "redo") {
        runRedo();
        return;
      }
      if (commandId === "delete-selected") {
        if (selectedObjectId) {
          removeObject(selectedObjectId);
          addConsoleEvent(`Removed object ${selectedObjectId.slice(0, 8)}`);
        }
        return;
      }
      if (commandId === "reset-view") {
        if (graphMode === "2d") {
          resetViewport2D();
        } else {
          requestCameraReset();
        }
        addConsoleEvent("Reset active viewport camera");
        return;
      }
      if (commandId === "export-scene-json") {
        const json = serializeScene(scene);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "vinculum-scene.json";
        anchor.click();
        URL.revokeObjectURL(url);
        addConsoleEvent("Exported scene JSON");
        return;
      }
      if (commandId === "import-scene-json") {
        importInputRef.current?.click();
        addConsoleEvent("Opened scene import picker");
      }
    },
    [
      addConsoleEvent,
      addParametricCurve,
      addPlaneObject,
      addSurfaceObject,
      applySceneSnapshot,
      graphMode,
      selectedObjectId,
      scene,
      requestCameraReset,
      replaceSceneDocument,
      removeObject,
      runRedo,
      runUndo,
      resetViewport2D,
      setGraphMode,
      setViewportMode
    ]
  );

  useEffect(() => {
    const current = getCurrentSceneSnapshot();
    const previous = prevSnapshotRef.current;
    const changed =
      previous.selection.selectedObjectId !== current.selection.selectedObjectId ||
      previous.objects !== current.objects;

    if (!changed) {
      return;
    }

    if (historyActionRef.current) {
      historyActionRef.current = false;
    } else {
      pushSnapshot(previous);
    }

    prevSnapshotRef.current = current;
  }, [pushSnapshot, scene, selectedObjectId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          runRedo();
        } else {
          runUndo();
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        runRedo();
        return;
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
        setContextMenu((state) => ({ ...state, open: false }));
        return;
      }

      const key = event.key.toLowerCase();
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        if (key === "1") {
          setGraphMode("2d");
          setViewportMode("2d");
          addConsoleEvent("Switched viewport to 2D");
          return;
        }
        if (key === "2") {
          setGraphMode("3d");
          setViewportMode("3d");
          addConsoleEvent("Switched viewport to 3D");
          return;
        }
        if (key === "3") {
          setViewportMode("split");
          addConsoleEvent("Switched viewport to Split");
          return;
        }
        if (key === "4") {
          setViewportMode("quad");
          addConsoleEvent("Switched viewport to Quad");
          return;
        }
      }
      if (key === "v" || key === "h") {
        setCanvas2dTool("pan");
        setCanvas3dTool("pan");
        return;
      }
      if (key === "s") {
        setCanvas2dTool("draw");
        setCanvas3dTool("draw");
        return;
      }
      if (key === "p" || key === "c") {
        setCanvas2dTool("probe");
        setCanvas3dTool("probe");
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedObjectId) {
        removeObject(selectedObjectId);
        return;
      }
      if (key === "f") {
        if (graphMode === "2d") {
          resetViewport2D();
        } else {
          requestCameraReset();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    graphMode,
    addConsoleEvent,
    removeObject,
    requestCameraReset,
    resetViewport2D,
    runRedo,
    runUndo,
    selectedObjectId,
    setGraphMode,
    setCanvas2dTool,
    setCanvas3dTool,
    setViewportMode
  ]);

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-[var(--surface-bg)]"
      onContextMenu={(event) => {
        event.preventDefault();
        setContextMenu({
          open: true,
          x: event.clientX,
          y: event.clientY
        });
      }}
    >
      <ThemeSync />
      <TopToolbar
        onOpenInspector={() => setInspectorOpen(true)}
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        onToggleLeftPanel={toggleLeftPanel}
        onToggleRightPanel={toggleRightPanel}
        onDecreaseLeftWidth={() => setLeftPanelWidth(leftWidth - 24)}
        onIncreaseLeftWidth={() => setLeftPanelWidth(leftWidth + 24)}
        onDecreaseRightWidth={() => setRightPanelWidth(rightWidth - 24)}
        onIncreaseRightWidth={() => setRightPanelWidth(rightWidth + 24)}
        viewportMode={effectiveViewportMode}
        onViewportModeChange={setViewportMode}
      />
      <div className="flex min-h-0 flex-1">
        {!leftCollapsed ? <LeftObjectBrowser width={leftWidth} /> : null}
        <main className="relative min-w-0 flex-1 bg-[var(--surface-canvas)]">
          <FloatingToolHUD
            modeLabel={effectiveViewportMode.toUpperCase()}
            toolLabel={(graphMode === "2d" ? canvas2dTool : canvas3dTool).toUpperCase()}
            selectedId={selectedObjectId}
          />
          <div className="absolute right-3 top-3 z-20 lg:hidden">
            <Button size="sm" variant="secondary" onClick={() => setInspectorOpen(true)}>
              Inspector
            </Button>
          </div>
          <GraphViewportErrorBoundary>
            <ViewportHost
              mode={effectiveViewportMode}
              viewport2d={<Viewport2D key="graph-2d" />}
              viewport3d={<Viewport3D key="graph-3d" />}
              selectedLabel={selectedLabel}
              primaryToolLabel={primaryToolLabel}
              secondaryToolLabel={secondaryToolLabel}
              zoomLabel={zoomLabel}
              snapLabel={snapLabel}
            />
          </GraphViewportErrorBoundary>
        </main>
        <div className="hidden lg:block">{!rightCollapsed ? <RightInspector width={rightWidth} /> : null}</div>
      </div>
      <BottomPanel />
      <StatusBar />
      <SceneImportExportDialog />
      <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen} title="Inspector">
        <RightInspector width={rightWidth} />
      </Sheet>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onRunCommand={runCommand}
      />
      <ContextMenu
        open={contextMenu.open}
        x={contextMenu.x}
        y={contextMenu.y}
        onRunCommand={runCommand}
        hasSelection={Boolean(selectedObjectId)}
        canUndo={canUndo}
        canRedo={canRedo}
        currentMode={effectiveViewportMode}
        onClose={() => setContextMenu((state) => ({ ...state, open: false }))}
      />
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }
          const text = await file.text();
          const parsed = deserializeScene(text);
          if (parsed.valid && parsed.normalizedScene) {
            clearHistory();
            replaceSceneDocument(parsed.normalizedScene);
            addConsoleEvent("Imported scene JSON");
          } else {
            addConsoleEvent(`Import failed: ${(parsed.errors ?? ["Unknown error"]).join(", ")}`);
          }
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
