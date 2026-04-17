"use client";

import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { MAX_VIEWPORT_SCALE, MIN_VIEWPORT_SCALE } from "@/lib/graph/viewport";
import { useGraphStore } from "@/store/graphStore";

export default function Toolbar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const resetScene = useGraphStore((state) => state.resetScene);
  const openSceneDialog = useGraphStore((state) => state.openSceneDialog);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const setGraphMode = useGraphStore((state) => state.setGraphMode);
  const axis2dPair = useGraphStore((state) => state.ui.axis2dPair);
  const setAxis2DPair = useGraphStore((state) => state.setAxis2DPair);
  const themeMode = useGraphStore((state) => state.ui.themeMode);
  const setThemeMode = useGraphStore((state) => state.setThemeMode);
  const cycleThemeMode = useGraphStore((state) => state.cycleThemeMode);
  const viewport2d = useGraphStore((state) => state.ui.viewport2d);
  const updateViewport2D = useGraphStore((state) => state.updateViewport2D);
  const resetViewport2D = useGraphStore((state) => state.resetViewport2D);
  const resolvedTheme = useResolvedTheme();

  const handleResetView = () => {
    if (graphMode === "2d") {
      resetViewport2D();
    } else {
      requestCameraReset();
    }
  };

  return (
    <header className="flex h-10 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3">
      <div className="flex min-w-0 items-center gap-3">
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
                ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--accent)]/40"
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
                ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--accent)]/40"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            3D
          </button>
        </div>
        
        <span className="shrink-0 text-[10px] text-[var(--text-tertiary)]">
          {objectCount} {objectCount === 1 ? "object" : "objects"}
        </span>

        {graphMode === "2d" && (
          <div className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-1.5 py-0.5">
            <label className="text-[10px] text-[var(--text-tertiary)]">Axes</label>
            <select
              value={axis2dPair}
              onChange={(event) => {
                const pair = event.target.value;
                if (pair === "xy" || pair === "yz" || pair === "xz") {
                  setAxis2DPair(pair);
                }
              }}
              className="h-6 rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-1.5 text-[10px] text-[var(--text-secondary)]"
              aria-label="2D axis pair"
            >
              <option value="xy">X / Y</option>
              <option value="yz">Y / Z</option>
              <option value="xz">X / Z</option>
            </select>
            <label className="text-[10px] text-[var(--text-tertiary)]">Scale</label>
            <input
              type="number"
              min={MIN_VIEWPORT_SCALE}
              max={MAX_VIEWPORT_SCALE}
              step="0.1"
              value={Number(viewport2d.scale.toPrecision(6))}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) {
                  updateViewport2D({ scale: next });
                }
              }}
              className="w-16 h-6 px-1.5 rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[10px] text-[var(--text-secondary)]"
              aria-label="2D axis scale"
            />
          </div>
        )}

        <div className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-1.5 py-0.5">
          <select
            value={themeMode}
            onChange={(event) => {
              const mode = event.target.value;
              if (mode === "system" || mode === "light" || mode === "dark") {
                setThemeMode(mode);
              }
            }}
            className="h-6 rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-1.5 text-[10px] text-[var(--text-secondary)]"
            aria-label="Theme mode"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <button
            type="button"
            onClick={cycleThemeMode}
            className="btn h-6 px-2"
            title={`Theme: ${themeMode} (${resolvedTheme})`}
            aria-label={`Cycle theme mode, current ${themeMode}`}
          >
            {resolvedTheme === "dark" ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1111.21 3c.2 0 .4.01.6.03A7 7 0 0021 12.79z" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <nav className="flex shrink-0 items-center gap-1">
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
