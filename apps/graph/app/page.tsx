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
        <main className="min-w-0 flex-1 bg-background p-2">
          <div className="h-full overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
            <GraphCanvas />
          </div>
        </main>
      </div>
      <SceneImportExportDialog />
    </div>
  );
}
