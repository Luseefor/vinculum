"use client";

import dynamic from "next/dynamic";
import GraphViewportErrorBoundary from "@/components/graph/GraphViewportErrorBoundary";
import BottomPanel from "@/components/editor/BottomPanel";
import LeftObjectBrowser from "@/components/editor/LeftObjectBrowser";
import RightInspector from "@/components/editor/RightInspector";
import StatusBar from "@/components/editor/StatusBar";
import TopToolbar from "@/components/editor/TopToolbar";
import SceneImportExportDialog from "@/components/scene/SceneImportExportDialog";
import ThemeSync from "@/components/theme/ThemeSync";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import Viewport2D from "@/components/viewport/Viewport2D";
import ViewportHost from "@/components/viewport/ViewportHost";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";
import { useState } from "react";

const Graph3DCanvas = dynamic(() => import("@/components/graph/GraphCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-[11px] text-[var(--text-tertiary)]">
      Loading 3D view…
    </div>
  )
});

export default function EditorShell() {
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const [inspectorOpen, setInspectorOpen] = useState(false);
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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--surface-bg)]">
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
              viewport3d={<Graph3DCanvas key="graph-3d" />}
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
    </div>
  );
}
