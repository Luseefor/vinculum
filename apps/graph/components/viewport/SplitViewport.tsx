"use client";

import { useMemo, useState, type ReactNode } from "react";

interface SplitViewportProps {
  primary: ReactNode;
  secondary: ReactNode;
}

export default function SplitViewport({ primary, secondary }: SplitViewportProps) {
  const [ratio, setRatio] = useState(0.5);
  const style = useMemo(
    () => ({
      gridTemplateColumns: `${(ratio * 100).toFixed(2)}% 10px minmax(0,1fr)`
    }),
    [ratio]
  );

  return (
    <>
      <div className="relative hidden h-full w-full lg:grid" style={style}>
        <div className="min-h-0 border-r border-[var(--border-strong)]">{primary}</div>
        <div
          className="relative cursor-col-resize bg-[var(--surface-bg)]"
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
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--border-strong)]" />
          <div className="absolute left-1/2 top-1/2 z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text-secondary)]">
            <span className="grid grid-cols-2 gap-0.5">
              <span className="h-1 w-1 rounded-full bg-[var(--text-secondary)]" />
              <span className="h-1 w-1 rounded-full bg-[var(--text-secondary)]" />
              <span className="h-1 w-1 rounded-full bg-[var(--text-secondary)]" />
              <span className="h-1 w-1 rounded-full bg-[var(--text-secondary)]" />
            </span>
          </div>
        </div>
        <div className="min-h-0">{secondary}</div>
      </div>
      <div className="grid h-full w-full grid-cols-1 grid-rows-2 lg:hidden">
        <div className="min-h-0 border-b border-[var(--border-subtle)]">{primary}</div>
        <div className="min-h-0">{secondary}</div>
      </div>
    </>
  );
}
