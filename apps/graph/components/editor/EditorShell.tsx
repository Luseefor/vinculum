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
  const effectiveViewportMode = viewportMode === "split" || viewportMode === "quad" ? viewportMode : graphMode;

  const runCommand = useCallback(
    (commandId: string) => {
      if (commandId === "add-surface") {
        addSurfaceObject();
        return;
      }
      if (commandId === "add-curve") {
        addParametricCurve();
        return;
      }
      if (commandId === "toggle-2d") {
        setGraphMode("2d");
        setViewportMode("2d");
        return;
      }
      if (commandId === "toggle-3d") {
        setGraphMode("3d");
        setViewportMode("3d");
        return;
      }
      if (commandId === "switch-split") {
        setViewportMode("split");
        return;
      }
      if (commandId === "reset-view") {
        if (graphMode === "2d") {
          resetViewport2D();
        } else {
          requestCameraReset();
        }
      }
    },
    [addParametricCurve, addSurfaceObject, graphMode, requestCameraReset, resetViewport2D, setGraphMode, setViewportMode]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
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
