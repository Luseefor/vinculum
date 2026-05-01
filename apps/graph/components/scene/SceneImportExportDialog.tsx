"use client";

import { useEffect, useMemo, useState } from "react";
import { cx } from "@/components/ui/styles";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { useGraphStore } from "@/store/graphStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
    }
  }, [dialogState.isOpen]);

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
    anchor.rel = "noopener";
    anchor.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
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
    <Dialog
      open={dialogState.isOpen}
      onOpenChange={(nextOpen) => !nextOpen && closeSceneDialog()}
    >
      <DialogContent className="max-w-2xl">
      <div className="flex max-h-[85vh] flex-col">
        <DialogHeader>
          <div>
            <DialogTitle>{isExportMode ? "Export Scene" : "Import Scene"}</DialogTitle>
            <DialogDescription>
              {isExportMode
                ? "Copy or download your scene as JSON"
                : "Paste a scene JSON to replace current scene"}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 min-h-0 p-5 overflow-y-auto">
          <textarea
            value={dialogState.jsonText}
            onChange={(event) => {
              setSceneDialogDraft(event.target.value);
              if (dialogState.error) {
                setSceneDialogError(null);
              }
            }}
            readOnly={isExportMode}
            spellCheck={false}
            data-autofocus="true"
            className="input h-80 resize-none font-mono text-xs leading-relaxed"
          />

          {importErrors.length > 0 && (
            <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
              <p className="text-xs font-semibold text-amber-400">Validation errors</p>
              <ul className="mt-2 space-y-1 text-[11px] text-amber-300/80">
                {importErrors.map((error, index) => (
                  <li key={`${error}-${index}`}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="items-center justify-between">
          <p
            className={cx(
              "text-[11px]",
              copyFeedback === "copied" && "text-emerald-400",
              copyFeedback === "failed" && "text-amber-400",
              copyFeedback === "idle" && "text-[var(--text-tertiary)]"
            )}
          >
            {isExportMode
              ? copyFeedback === "copied"
                ? "Copied to clipboard"
                : copyFeedback === "failed"
                  ? "Failed to copy"
                  : "JSON is versioned and portable"
              : "This will replace your current scene"}
          </p>

          <div className="flex items-center gap-2">
            {isExportMode ? (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={handleCopyJson}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Copy
                </Button>

                <Button type="button" variant="secondary" size="sm" onClick={handleDownloadJson}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download
                </Button>
              </>
            ) : (
              <Button type="button" variant="primary" size="sm" onClick={handleImportScene}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 16 12 12 8 16" />
                  <line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
                </svg>
                Import
              </Button>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={closeSceneDialog}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </div>
      </DialogContent>
    </Dialog>
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
