"use client";

import { Check, Copy, Download, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { useGraphStore } from "@/store/graphStore";

export default function SceneImportExportDialog() {
  const sceneName = useGraphStore((state) => state.scene.metadata.name);
  const dialogState = useGraphStore((state) => state.ui.sceneDialog);
  const closeSceneDialog = useGraphStore((state) => state.closeSceneDialog);
  const setSceneDialogDraft = useGraphStore((state) => state.setSceneDialogDraft);
  const setSceneDialogError = useGraphStore((state) => state.setSceneDialogError);
  const replaceSceneDocument = useGraphStore((state) => state.replaceSceneDocument);

  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (!dialogState.isOpen) {
      setCopyFeedback("idle");
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSceneDialog();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeSceneDialog, dialogState.isOpen]);

  const importErrors = useMemo(
    () =>
      dialogState.error
        ? dialogState.error
            .split("\n")
            .map((error) => error.trim())
            .filter(Boolean)
        : [],
    [dialogState.error]
  );

  if (!dialogState.isOpen) {
    return null;
  }

  const isExportMode = dialogState.mode === "export";
  const exportFileName = `${slugify(sceneName || "scene")}.json`;

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(dialogState.jsonText);
      setCopyFeedback("copied");
    } catch {
      setCopyFeedback("failed");
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([dialogState.jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exportFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportScene = () => {
    const result = deserializeScene(dialogState.jsonText);
    if (!result.valid || !result.normalizedScene) {
      setSceneDialogError(result.errors.join("\n"));
      return;
    }

    replaceSceneDocument(result.normalizedScene);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeSceneDialog();
        }
      }}
    >
      <div className="skeuo-panel flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1rem] text-card-foreground">
        <div className="flex items-start justify-between border-b border-border/75 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              {isExportMode ? "Export Scene JSON" : "Import Scene JSON"}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {isExportMode
                ? "Scene JSON is versioned and stable for tooling workflows."
                : "Paste a scene document. Validation runs before replacing the current scene."}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="skeuo-pill h-8 w-8 rounded-md"
            onClick={closeSceneDialog}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close dialog</span>
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <Textarea
            value={dialogState.jsonText}
            onChange={(event) => {
              setSceneDialogDraft(event.target.value);
              if (dialogState.error) {
                setSceneDialogError(null);
              }
            }}
            readOnly={isExportMode}
            spellCheck={false}
            className="skeuo-inset min-h-[360px] resize-none border-border/80 bg-background/85 font-mono text-xs leading-6"
          />

          {importErrors.length > 0 ? (
            <div className="skeuo-inset rounded-md border border-destructive/45 bg-destructive/10 px-3 py-2">
              <p className="text-xs font-semibold text-destructive">Import validation errors</p>
              <ul className="mt-1.5 space-y-1 text-xs text-destructive/90">
                {importErrors.map((error, index) => (
                  <li key={`${error}-${index}`}>• {error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t border-border/75 pt-3">
            <p
              className={cn(
                "text-xs",
                copyFeedback === "copied" && "text-emerald-600 dark:text-emerald-400",
                copyFeedback === "failed" && "text-destructive",
                copyFeedback === "idle" && "text-muted-foreground"
              )}
            >
              {isExportMode
                ? copyFeedback === "copied"
                  ? "JSON copied to clipboard."
                  : copyFeedback === "failed"
                    ? "Clipboard access failed."
                    : "Exported JSON is pretty-printed and ready to save."
                : "Import replaces the current scene if validation passes."}
            </p>

            <div className="flex items-center gap-2">
              {isExportMode ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="skeuo-pill h-8 gap-1.5 text-[0.8rem] font-semibold"
                    onClick={handleCopyJson}
                  >
                    {copyFeedback === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    Copy JSON
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="skeuo-pill h-8 gap-1.5 text-[0.8rem] font-semibold"
                    onClick={handleDownloadJson}
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </>
              ) : (
                <Button type="button" className="skeuo-pill h-8 text-[0.8rem] font-semibold" onClick={handleImportScene}>
                  Validate and Import
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "scene"
  );
}
