"use client";

import { useGraphStore } from "@/store/graphStore";

export default function Toolbar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const resetScene = useGraphStore((state) => state.resetScene);
  const openSceneDialog = useGraphStore((state) => state.openSceneDialog);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);

  return (
    <header className="flex h-11 items-center justify-between px-4 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold tracking-tight">Vinculum</h1>
        <span className="text-[11px] text-[var(--text-tertiary)] bg-black/20 px-2 py-0.5 rounded">
          {objectCount} {objectCount === 1 ? "object" : "objects"}
        </span>
      </div>

      <nav className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (objectCount > 0) {
              const confirmed = window.confirm("Create a new scene and discard current objects?");
              if (!confirmed) return;
            }
            resetScene();
          }}
          className="btn"
        >
          New
        </button>
        <button type="button" onClick={() => openSceneDialog("export")} className="btn">
          Export
        </button>
        <button type="button" onClick={() => openSceneDialog("import")} className="btn">
          Import
        </button>
        <div className="w-px h-5 bg-[var(--border-subtle)] mx-1" />
        <button type="button" onClick={requestCameraReset} className="btn">
          Reset View
        </button>
      </nav>
    </header>
  );
}
