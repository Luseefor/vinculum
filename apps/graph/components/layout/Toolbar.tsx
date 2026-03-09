"use client";

import { ui, cx } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";

export default function Toolbar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const resetScene = useGraphStore((state) => state.resetScene);
  const openSceneDialog = useGraphStore((state) => state.openSceneDialog);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);

  return (
    <header className="flex h-12 items-center justify-between border-b border-slate-800/90 bg-slate-950/95 px-3.5">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold tracking-wide text-slate-100">Vinculum Graph</h1>
        <span className={ui.badge}>
          {objectCount} object{objectCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-slate-800/90 bg-slate-900/35 p-1">
          <button
            type="button"
            onClick={() => {
              if (objectCount > 0) {
                const confirmed = window.confirm("Create a new scene and discard current objects?");
                if (!confirmed) {
                  return;
                }
              }

              resetScene();
            }}
            className={cx(ui.buttonBase, ui.buttonSubtle)}
          >
            New Scene
          </button>

          <button
            type="button"
            onClick={() => openSceneDialog("export")}
            className={cx(ui.buttonBase, ui.buttonSubtle)}
          >
            Export JSON
          </button>

          <button
            type="button"
            onClick={() => openSceneDialog("import")}
            className={cx(ui.buttonBase, ui.buttonSubtle)}
          >
            Import JSON
          </button>
        </div>

        <button
          type="button"
          onClick={requestCameraReset}
          className={cx(ui.buttonBase, ui.buttonSubtle)}
        >
          Reset View
        </button>
      </div>
    </header>
  );
}
