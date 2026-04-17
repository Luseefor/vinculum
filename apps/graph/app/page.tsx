"use client";

import GraphCanvas from "@/components/graph/GraphCanvas";
import { Graph2DCanvas } from "@/components/graph/Graph2DCanvas";
import Sidebar from "@/components/layout/Sidebar";
import StatusBar from "@/components/layout/StatusBar";
import Toolbar from "@/components/layout/Toolbar";
import SceneImportExportDialog from "@/components/scene/SceneImportExportDialog";
import ThemeSync from "@/components/theme/ThemeSync";
import { useGraphStore } from "@/store/graphStore";

export default function HomePage() {
  const graphMode = useGraphStore((state) => state.ui.graphMode);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--surface-bg)]">
      <ThemeSync />
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 p-3">
          <div className="h-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] shadow-[0_10px_36px_rgba(0,0,0,0.22)]">
            {graphMode === "2d" ? <Graph2DCanvas /> : <GraphCanvas />}
          </div>
        </main>
      </div>
      <StatusBar />
      <SceneImportExportDialog />
    </div>
  );
}
