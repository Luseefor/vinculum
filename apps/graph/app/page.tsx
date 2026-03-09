import GraphCanvas from "@/components/graph/GraphCanvas";
import Sidebar from "@/components/layout/Sidebar";
import Toolbar from "@/components/layout/Toolbar";
import SceneImportExportDialog from "@/components/scene/SceneImportExportDialog";

export default function HomePage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 p-2">
          <div className="h-full overflow-hidden rounded-md border border-slate-800/80 bg-slate-950/80">
            <GraphCanvas />
          </div>
        </main>
      </div>
      <SceneImportExportDialog />
    </div>
  );
}
