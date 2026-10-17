"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

interface SplitViewportProps {
  primary: ReactNode;
  secondary: ReactNode;
  lowerLeft?: ReactNode;
  lowerRight?: ReactNode;
  mode?: "2d" | "3d" | "split" | "quad";
}

// S30: single responsive tree. The previous dual-tree (desktop + mobile
// copies) mounted every viewport twice in split mode — two WebGL contexts,
// two engines, duplicate worker jobs — and remounted everything when
// resizing across the lg breakpoint. One tree, CSS-driven stacking.
export default function SplitViewport({ primary, secondary, lowerLeft, lowerRight, mode = "split" }: SplitViewportProps) {
  const [ratio, setRatio] = useState(0.5);
  const style = useMemo(
    () =>
      ({
        "--split-ratio": `${(ratio * 100).toFixed(2)}%`
      }) as CSSProperties,
    [ratio]
  );

  return (
    <div
      className={mode === "quad" ? "relative grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-(--border-strong)" : mode === "split" ? "relative grid h-full w-full grid-cols-1 grid-rows-2 lg:grid-cols-[var(--split-ratio)_10px_minmax(0,1fr)] lg:grid-rows-1" : "relative h-full w-full"}
      style={style}
    >
      <div key="primary" hidden={mode === "3d"} className={mode === "split" ? "min-h-0 min-w-0 border-b border-(--border-subtle) lg:border-b-0 lg:border-r lg:border-(--border-strong)" : "h-full min-h-0 min-w-0"}>{primary}</div>
      {mode === "split" ? <div
        key="divider"
        role="separator"
        aria-label="Resize 2D and 3D views"
        aria-orientation="vertical"
        aria-valuemin={28}
        aria-valuemax={72}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          setRatio(current => event.key === "Home" ? 0.28 : event.key === "End" ? 0.72 : Math.max(0.28, Math.min(0.72, current + (event.key === "ArrowLeft" ? -0.02 : 0.02))));
        }}
        className="relative hidden cursor-col-resize bg-(--surface-bg) outline-hidden focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-(--accent) lg:block"
        onPointerDown={(event) => {
            const element = event.currentTarget.parentElement;
            if (!element) {
              return;
            }

            const bounds = element.getBoundingClientRect();
            const onMove = (moveEvent: PointerEvent) => {
              const next = (moveEvent.clientX - bounds.left) / bounds.width;
              setRatio(Math.max(0.28, Math.min(0.72, next)));
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };

            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          }}
        >
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-(--border-strong)" />
          <div className="absolute left-1/2 top-1/2 z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[var(--ui-radius-sm)] border border-(--border-strong) bg-(--surface-raised) text-(--text-secondary)">
            <span className="grid grid-cols-2 gap-0.5">
              <span className="h-1 w-1 rounded-full bg-(--text-secondary)" />
              <span className="h-1 w-1 rounded-full bg-(--text-secondary)" />
              <span className="h-1 w-1 rounded-full bg-(--text-secondary)" />
              <span className="h-1 w-1 rounded-full bg-(--text-secondary)" />
            </span>
          </div>
        </div> : null}
        <div key="secondary" hidden={mode === "2d"} className={mode === "split" ? "min-h-0 min-w-0" : "h-full min-h-0 min-w-0"}>{secondary}</div>
        <div key="lower-left" hidden={mode !== "quad"} className="h-full min-h-0 min-w-0">{lowerLeft}</div>
        <div key="lower-right" hidden={mode !== "quad"} className="h-full min-h-0 min-w-0">{lowerRight}</div>
    </div>
  );
}
