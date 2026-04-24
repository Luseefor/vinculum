"use client";

import type { ReactNode } from "react";

interface SplitViewportProps {
  primary: ReactNode;
  secondary: ReactNode;
}

export default function SplitViewport({ primary, secondary }: SplitViewportProps) {
  return (
    <div className="grid h-full w-full grid-cols-1 lg:grid-cols-2">
      <div className="min-h-0 border-b border-[var(--border-subtle)] lg:border-b-0 lg:border-r">{primary}</div>
      <div className="min-h-0">{secondary}</div>
    </div>
  );
}
