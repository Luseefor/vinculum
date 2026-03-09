"use client";

import { useEffect, useMemo, useState } from "react";
import { ui, cx } from "@/components/ui/styles";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-[0_20px_80px_rgba(2,6,23,0.75)]">
        <div className="flex items-start justify-between border-b border-slate-800/90 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {isExportMode ? "Export Scene JSON" : "Import Scene JSON"}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {isExportMode
                ? "Scene document is serializable and versioned for future tooling."
                : "Paste a scene document. Validation runs before replacing the current scene."}
            </p>
          </div>

          <button
            type="button"
            onClick={closeSceneDialog}
            className={cx(ui.buttonBase, ui.buttonSubtle, "px-2 py-1")}
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
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
            className={ui.textarea}
          />

          {importErrors.length > 0 ? (
            <div className="rounded-md border border-amber-700/50 bg-amber-950/25 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-200">Import validation errors</p>
              <ul className="mt-1.5 space-y-1 text-xs text-amber-100/90">
                {importErrors.map((error, index) => (
                  <li key={`${error}-${index}`}>• {error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t border-slate-800/80 pt-3">
            <p
              className={cx(
                "text-xs",
                copyFeedback === "copied" && "text-emerald-300",
                copyFeedback === "failed" && "text-amber-300",
                copyFeedback === "idle" && "text-slate-500"
              )}
            >
              {isExportMode
                ? copyFeedback === "copied"
                  ? "JSON copied to clipboard."
                  : copyFeedback === "failed"
                    ? "Clipboard access failed."
                    : "Exported JSON is pretty-printed and versioned."
                : "Import replaces the current scene if validation passes."}
            </p>

            <div className="flex items-center gap-2">
              {isExportMode ? (
                <>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className={cx(ui.buttonBase, ui.buttonSubtle)}
                  >
                    Copy JSON
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className={cx(ui.buttonBase, ui.buttonSubtle)}
                  >
                    Download .json
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleImportScene}
                  className={cx(ui.buttonBase, ui.buttonPrimary)}
                >
                  Validate and Import
                </button>
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
