"use client";

import { useCallback, useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";

interface DialProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  label?: string;
  onChange: (value: number) => void;
  className?: string;
}

const MIN_ANGLE = -135;
const MAX_ANGLE = 135;

export function Dial({ value, min, max, step = 1, label, onChange, className }: DialProps) {
  const dialRef = useRef<HTMLDivElement | null>(null);

  const clampedValue = clamp(value, min, max);
  const normalized = (clampedValue - min) / Math.max(1e-6, max - min);
  const angle = MIN_ANGLE + normalized * (MAX_ANGLE - MIN_ANGLE);

  const updateFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const dial = dialRef.current;
      if (!dial) {
        return;
      }

      const rect = dial.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // 0 degrees at top, clockwise positive.
      const rawAngle = (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI + 90;
      const wrappedAngle = rawAngle > 180 ? rawAngle - 360 : rawAngle;
      const constrainedAngle = clamp(wrappedAngle, MIN_ANGLE, MAX_ANGLE);
      const t = (constrainedAngle - MIN_ANGLE) / (MAX_ANGLE - MIN_ANGLE);
      const nextValue = min + t * (max - min);

      onChange(quantize(nextValue, step, min, max));
    },
    [max, min, onChange, step]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      updateFromPoint(event.clientX, event.clientY);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        updateFromPoint(moveEvent.clientX, moveEvent.clientY);
      };

      const stopTracking = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopTracking);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopTracking, { once: true });
    },
    [updateFromPoint]
  );

  const ariaText = useMemo(() => {
    if (!label) {
      return String(clampedValue);
    }

    return `${label}: ${clampedValue}`;
  }, [clampedValue, label]);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        ref={dialRef}
        role="slider"
        tabIndex={0}
        aria-label={label ?? "Dial"}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clampedValue}
        aria-valuetext={ariaText}
        onPointerDown={handlePointerDown}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onChange(quantize(clampedValue + step, step, min, max));
          }

          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onChange(quantize(clampedValue - step, step, min, max));
          }
        }}
        className="relative h-20 w-20 cursor-grab rounded-full border border-border/80 bg-[radial-gradient(circle_at_28%_20%,hsl(var(--foreground)/0.32)_0%,hsl(var(--muted)/0.08)_32%,hsl(var(--background)/0.95)_100%)] shadow-[inset_0_1px_1px_hsl(var(--foreground)/0.3),inset_0_-5px_12px_hsl(var(--background)/0.8),0_10px_14px_hsl(var(--background)/0.7)] outline-none transition active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div
          className="absolute left-1/2 top-1/2 h-[38%] w-[3px] origin-bottom rounded-full bg-primary shadow-[0_0_4px_hsl(var(--primary)/0.6)]"
          style={{ transform: `translate(-50%, -100%) rotate(${angle}deg)` }}
        />
        <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/80 bg-background shadow-[inset_0_1px_1px_hsl(var(--foreground)/0.18)]" />
      </div>

      <p className="text-xs font-semibold tabular-nums text-muted-foreground">{Math.round(clampedValue)}</p>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function quantize(value: number, step: number, min: number, max: number): number {
  const safeStep = Math.max(1e-6, step);
  const quantized = Math.round(value / safeStep) * safeStep;
  return clamp(quantized, min, max);
}
