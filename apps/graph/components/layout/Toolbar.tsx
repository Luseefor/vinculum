"use client";

import { Camera, Download, FilePlus2, Layers2, Upload } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/graphStore";

export default function Toolbar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const viewportMode = useGraphStore((state) => state.ui.viewportMode);
  const setViewportMode = useGraphStore((state) => state.setViewportMode);
  const resetScene = useGraphStore((state) => state.resetScene);
  const openSceneDialog = useGraphStore((state) => state.openSceneDialog);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);

  return (
    <header className="flex h-12 items-center justify-between border-b border-border/90 bg-card px-3">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <Layers2 className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-[1.15rem] font-semibold tracking-tight">Vinculum Graph</h1>
        </div>

        <Badge variant="outline" className="h-7 rounded-md border-border/80 px-2 text-[0.82rem] font-medium text-muted-foreground">
          {objectCount} expression{objectCount === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex items-center rounded-md border border-border/80 bg-background p-0.5">
          <Button
            type="button"
            size="sm"
            variant={viewportMode === "2d" ? "default" : "ghost"}
            className={cn("h-7 px-2 text-[0.75rem] font-semibold", viewportMode === "2d" && "shadow-sm")}
            onClick={() => setViewportMode("2d")}
            aria-pressed={viewportMode === "2d"}
          >
            2D
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewportMode === "3d" ? "default" : "ghost"}
            className={cn("h-7 px-2 text-[0.75rem] font-semibold", viewportMode === "3d" && "shadow-sm")}
            onClick={() => setViewportMode("3d")}
            aria-pressed={viewportMode === "3d"}
          >
            3D
          </Button>
        </div>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-md border-border/80 px-2.5"
          onClick={() => {
            if (objectCount > 0) {
              const confirmed = window.confirm("Create a new scene and discard current expressions?");
              if (!confirmed) {
                return;
              }
            }

            resetScene();
          }}
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          New Scene
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-md border-border/80 px-2.5"
          onClick={() => openSceneDialog("export")}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-md border-border/80 px-2.5"
          onClick={() => openSceneDialog("import")}
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-md border-border/80 px-2.5"
          onClick={requestCameraReset}
        >
          <Camera className="h-3.5 w-3.5" />
          Reset View
        </Button>

        <Separator orientation="vertical" className="mx-1 h-5" />
        <ThemeToggle />
      </div>
    </header>
  );
}
