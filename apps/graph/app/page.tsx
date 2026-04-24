"use client";

import dynamic from "next/dynamic";
import GraphViewportErrorBoundary from "@/components/graph/GraphViewportErrorBoundary";
import { Graph2DCanvas } from "@/components/graph/Graph2DCanvas";
import Sidebar from "@/components/layout/Sidebar";
import StatusBar from "@/components/layout/StatusBar";
import Toolbar from "@/components/layout/Toolbar";
import SceneImportExportDialog from "@/components/scene/SceneImportExportDialog";
import ThemeSync from "@/components/theme/ThemeSync";
import { useGraphStore } from "@/store/graphStore";

const Graph3DCanvas = dynamic(() => import("@/components/graph/GraphCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-[11px] text-[var(--text-tertiary)]">
      Loading 3D view…
    </div>
  )
});

export default function HomePage() {
  const graphMode = useGraphStore((state) => state.ui.graphMode);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--surface-bg)]">
      <ThemeSync />
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 border-l border-[var(--border-subtle)] bg-[var(--surface-canvas)]">
          <GraphViewportErrorBoundary>
            {graphMode === "2d" ? <Graph2DCanvas key="graph-2d" /> : <Graph3DCanvas key="graph-3d" />}
          </GraphViewportErrorBoundary>
        </main>
      </div>
      <StatusBar />
      <SceneImportExportDialog />
    </div>
  );
}
