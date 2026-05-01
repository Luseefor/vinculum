"use client";

import * as React from "react";
import { cn } from "@/components/ui/styles";

type BadgeVariant = "default" | "secondary" | "outline";

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default: "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]",
  secondary: "border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)]",
  outline: "border-[var(--border-strong)] bg-transparent text-[var(--text-secondary)]"
};

export function Badge({
  className,
  variant = "secondary",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: BadgeVariant }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        badgeVariantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
