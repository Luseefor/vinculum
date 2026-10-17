"use client";

import ViewControls, { type ViewControlsProps } from "@/components/editor/ViewControls";
import { ExpandIcon } from "@/components/layout/icons";

const ICON_BUTTON =
  "ui-control flex h-7 w-7 items-center justify-center rounded-[var(--ui-radius-sm)] text-(--text-secondary) outline-hidden hover:bg-(--surface-muted) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--accent) disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

/** Wide-composition canvas header: view controls left, fit-to-view right. */
export default function CanvasToolbar({
  viewControls,
  onFitScene
}: {
  viewControls: ViewControlsProps;
  onFitScene: () => void;
}) {
  return (
    <div className="flex min-h-12 shrink-0 items-center gap-3 bg-(--surface-canvas) px-4 py-2">
      <div className="min-w-0 flex-1 overflow-x-auto scrollbar-none">
        <ViewControls {...viewControls} />
      </div>
      <button
        type="button"
        onClick={onFitScene}
        aria-label="Zoom to fit all objects"
        title="Zoom to fit all objects (F)"
        className={ICON_BUTTON}
      >
        <ExpandIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
