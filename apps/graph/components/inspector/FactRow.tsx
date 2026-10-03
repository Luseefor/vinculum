// S35 shared fact row — one presentation for Geometry Analysis, Linear Algebra,
// and other Inspector result lists. Values align right; no card chrome.

"use client";

import type { ReactNode } from "react";
import { MathText } from "@/components/math/MathExpression";

export function FactRow({
  label,
  value,
  testId
}: {
  label: string;
  value: ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[11px] text-[var(--text-secondary)]"><MathText text={label} /></span>
      <span
        data-testid={testId}
        className="min-w-0 break-words text-right text-[12px] text-[var(--text-primary)]"
      >
        {typeof value === "string" ? <MathText text={value} /> : value}
      </span>
    </div>
  );
}
