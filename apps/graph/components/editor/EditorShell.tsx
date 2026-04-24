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
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";
import { useCallback, useEffect, useState } from "react";

export default function EditorShell() {
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const addSurfaceObject = useGraphStore((state) => state.addSurfaceObject);
  const addParametricCurve = useGraphStore((state) => state.addParametricCurve);
  const setGraphMode = useGraphStore((state) => state.setGraphMode);
  const setCanvas2dTool = useGraphStore((state) => state.setCanvas2dTool);
  const setCanvas3dTool = useGraphStore((state) => state.setCanvas3dTool);
  const canvas2dTool = useGraphStore((state) => state.ui.canvas2dTool);
  const canvas3dTool = useGraphStore((state) => state.ui.canvas3dTool);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const removeObject = useGraphStore((state) => state.removeObject);
  const resetViewport2D = useGraphStore((state) => state.resetViewport2D);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0
  });
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
  const effectiveViewportMode = viewportMode === "split" || viewportMode === "quad" ? viewportMode : graphMode;

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
      if (commandId === "reset-view") {
        if (graphMode === "2d") {
          resetViewport2D();
        } else {
          requestCameraReset();
        }
        addConsoleEvent("Reset active viewport camera");
      }
    },
    [
      addConsoleEvent,
      addParametricCurve,
      addSurfaceObject,
      graphMode,
      requestCameraReset,
      resetViewport2D,
      setGraphMode,
      setViewportMode
    ]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        return;
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
        setContextMenu((state) => ({ ...state, open: false }));
        return;
      }

      const key = event.key.toLowerCase();
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
    removeObject,
    requestCameraReset,
    resetViewport2D,
    selectedObjectId,
    setCanvas2dTool,
    setCanvas3dTool
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
        onClose={() => setContextMenu((state) => ({ ...state, open: false }))}
      />
    </div>
  );
}
