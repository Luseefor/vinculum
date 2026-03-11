"use client";

import { Camera, Download, FilePlus2, Layers2, PaintBucket, ScanLine, Upload } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/graphStore";

const ACTION_BUTTON_CLASS =
  "skeuo-pill h-8 gap-1.5 rounded-lg border-border/80 px-2.5 text-[0.78rem] font-semibold tracking-[0.02em] text-foreground/92";

export default function Toolbar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const viewportMode = useGraphStore((state) => state.ui.viewportMode);
  const surface2DRenderMode = useGraphStore((state) => state.ui.surface2DRenderMode);

  const setViewportMode = useGraphStore((state) => state.setViewportMode);
  const setSurface2DRenderMode = useGraphStore((state) => state.setSurface2DRenderMode);
  const resetScene = useGraphStore((state) => state.resetScene);
  const openSceneDialog = useGraphStore((state) => state.openSceneDialog);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);

  return (
    <header className="skeuo-toolbar flex h-14 items-center justify-between border-b border-border/85 px-3.5">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2">
          <div className="skeuo-pill flex h-7 w-7 items-center justify-center rounded-md">
            <Layers2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <h1 className="text-[1.1rem] font-semibold tracking-tight text-foreground">Vinculum Graph</h1>
        </div>

        <Badge
          variant="outline"
          className="skeuo-pill h-7 rounded-md border-border/80 px-2 text-[0.79rem] font-medium text-muted-foreground"
        >
          {objectCount} expression{objectCount === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="skeuo-inset flex items-center gap-1 p-1">
          <button
            type="button"
            className={cn(
              "h-7 min-w-[2.45rem] rounded-md px-2 text-[0.75rem] font-semibold tracking-[0.08em] transition-colors",
              viewportMode === "2d" ? "skeuo-pill text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setViewportMode("2d")}
            aria-pressed={viewportMode === "2d"}
          >
            2D
          </button>
          <button
            type="button"
            className={cn(
              "h-7 min-w-[2.45rem] rounded-md px-2 text-[0.75rem] font-semibold tracking-[0.08em] transition-colors",
              viewportMode === "3d" ? "skeuo-pill text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setViewportMode("3d")}
            aria-pressed={viewportMode === "3d"}
          >
            3D
          </button>
        </div>

        {viewportMode === "2d" ? (
          <div className="skeuo-inset flex items-center gap-1 p-1">
            <button
              type="button"
              className={cn(
                "flex h-7 items-center gap-1 rounded-md px-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] transition-colors",
                surface2DRenderMode === "fill"
                  ? "skeuo-pill text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setSurface2DRenderMode("fill")}
              aria-pressed={surface2DRenderMode === "fill"}
            >
              <PaintBucket className="h-3.5 w-3.5" />
              Fill
            </button>

            <button
              type="button"
              className={cn(
                "flex h-7 items-center gap-1 rounded-md px-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] transition-colors",
                surface2DRenderMode === "outline"
                  ? "skeuo-pill text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setSurface2DRenderMode("outline")}
              aria-pressed={surface2DRenderMode === "outline"}
            >
              <ScanLine className="h-3.5 w-3.5" />
              Outline
            </button>
          </div>
        ) : null}

        <Separator orientation="vertical" className="mx-1 h-6 bg-border/80" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={ACTION_BUTTON_CLASS}
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
          variant="ghost"
          size="sm"
          className={ACTION_BUTTON_CLASS}
          onClick={() => openSceneDialog("export")}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={ACTION_BUTTON_CLASS}
          onClick={() => openSceneDialog("import")}
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={ACTION_BUTTON_CLASS}
          onClick={requestCameraReset}
        >
          <Camera className="h-3.5 w-3.5" />
          Reset View
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 bg-border/80" />
        <ThemeToggle />
      </div>
    </header>
  );
}
