import GraphCanvas from "@/components/graph/GraphCanvas";
import Sidebar from "@/components/layout/Sidebar";
import Toolbar from "@/components/layout/Toolbar";
import SceneImportExportDialog from "@/components/scene/SceneImportExportDialog";

export default function HomePage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 border-l border-border bg-card">
          <GraphCanvas />
        </main>
      </div>
      <SceneImportExportDialog />
    </div>
  );
}
