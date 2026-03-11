import GraphCanvas from "@/components/graph/GraphCanvas";
import Sidebar from "@/components/layout/Sidebar";
import Toolbar from "@/components/layout/Toolbar";
import SceneImportExportDialog from "@/components/scene/SceneImportExportDialog";

export default function HomePage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top,hsl(var(--card)/0.7),hsl(var(--background))_58%)] text-foreground">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 p-2.5">
          <div className="skeuo-panel h-full overflow-hidden rounded-[1rem]">
            <GraphCanvas />
          </div>
        </main>
      </div>
      <SceneImportExportDialog />
    </div>
  );
}
