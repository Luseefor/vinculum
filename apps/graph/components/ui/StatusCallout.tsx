// S35 unified status language: local callouts for error / warning / pending /
// neutral-unavailable. Never paints an entire Inspector panel.

"use client";

import type { ReactNode } from "react";
import { cn } from "@/components/ui/styles";

export type StatusTone = "error" | "warning" | "pending" | "neutral";

export function StatusCallout({
  tone,
  children,
  className,
  role = "status",
  testId
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
  role?: "status" | "alert";
  testId?: string;
}) {
  return (
    <div
      data-tone={tone}
      data-testid={testId}
      role={role}
      className={cn("status-callout", className)}
    >
      <StatusGlyph tone={tone} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function StatusGlyph({ tone }: { tone: StatusTone }) {
  if (tone === "pending") {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 animate-spin rounded-full border border-[var(--border-strong)] border-t-[var(--text-secondary)] motion-reduce:animate-none"
      />
    );
  }

  const label = tone === "error" ? "!" : tone === "warning" ? "!" : "·";
  return (
    <span
      aria-hidden="true"
      className="mt-px inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-current text-[9px] font-semibold leading-none opacity-80"
    >
      {label}
    </span>
  );
}
