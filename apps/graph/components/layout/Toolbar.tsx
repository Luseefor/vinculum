"use client";

import { useGraphStore } from "@/store/graphStore";

export default function Toolbar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const resetScene = useGraphStore((state) => state.resetScene);
  const openSceneDialog = useGraphStore((state) => state.openSceneDialog);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const setGraphMode = useGraphStore((state) => state.setGraphMode);
  const viewport2d = useGraphStore((state) => state.ui.viewport2d);
  const updateViewport2D = useGraphStore((state) => state.updateViewport2D);
  const resetViewport2D = useGraphStore((state) => state.resetViewport2D);

  const handleResetView = () => {
    if (graphMode === "2d") {
      resetViewport2D();
    } else {
      requestCameraReset();
    }
  };

  return (
    <header className="flex h-10 items-center justify-between px-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
          <h1 className="text-xs font-semibold tracking-tight">Vinculum</h1>
        </div>
        
        {/* Mode Toggle */}
        <div className="flex items-center bg-[var(--surface-bg)] rounded-md p-0.5 border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setGraphMode("2d")}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
              graphMode === "2d"
                ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            2D
          </button>
          <button
            type="button"
            onClick={() => setGraphMode("3d")}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
              graphMode === "3d"
                ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            3D
          </button>
        </div>
        
        <span className="text-[10px] text-[var(--text-tertiary)]">
          {objectCount} {objectCount === 1 ? "object" : "objects"}
        </span>

        {graphMode === "2d" && (
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-[var(--text-tertiary)]">X</label>
            <input
              type="number"
              step="0.5"
              value={Number(viewport2d.centerX.toFixed(2))}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) {
                  updateViewport2D({ centerX: next });
                }
              }}
              className="w-16 h-6 px-1.5 rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[10px] text-[var(--text-secondary)]"
              aria-label="2D axis center X"
            />
            <label className="text-[10px] text-[var(--text-tertiary)]">Y</label>
            <input
              type="number"
              step="0.5"
              value={Number(viewport2d.centerY.toFixed(2))}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) {
                  updateViewport2D({ centerY: next });
                }
              }}
              className="w-16 h-6 px-1.5 rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[10px] text-[var(--text-secondary)]"
              aria-label="2D axis center Y"
            />
            <label className="text-[10px] text-[var(--text-tertiary)]">Scale</label>
            <input
              type="number"
              min="1"
              max="1000"
              step="1"
              value={Math.round(viewport2d.scale)}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) {
                  updateViewport2D({ scale: Math.max(1, Math.min(1000, next)) });
                }
              }}
              className="w-16 h-6 px-1.5 rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[10px] text-[var(--text-secondary)]"
              aria-label="2D axis scale"
            />
          </div>
        )}
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
        
        <button type="button" onClick={handleResetView} className="btn">
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
