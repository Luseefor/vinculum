"use client";

import { useGraphStore } from "@/store/graphStore";

export default function Toolbar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const resetScene = useGraphStore((state) => state.resetScene);
  const openSceneDialog = useGraphStore((state) => state.openSceneDialog);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);

  return (
    <header className="flex h-10 items-center justify-between px-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
          <h1 className="text-xs font-semibold tracking-tight">Vinculum</h1>
        </div>
        <span className="text-[10px] text-[var(--text-tertiary)]">
          {objectCount} {objectCount === 1 ? "object" : "objects"}
        </span>
      </div>

      <nav className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            if (objectCount > 0) {
              const confirmed = window.confirm("Create a new scene?");
              if (!confirmed) return;
            }
            resetScene();
          }}
          className="btn"
        >
          New
        </button>
        
        <div className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />
        
        <button type="button" onClick={() => openSceneDialog("import")} className="btn">
          Import
        </button>
        <button type="button" onClick={() => openSceneDialog("export")} className="btn">
          Export
        </button>
        
        <div className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />
        
        <button type="button" onClick={requestCameraReset} className="btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
          Reset
        </button>
      </nav>
    </header>
  );
}
