"use client";

import * as React from "react";
import { cn } from "@/components/ui/styles";

type BadgeVariant = "default" | "secondary" | "outline";

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default: "border-(--accent)/40 bg-(--accent-soft) text-(--accent-ink)",
  secondary: "border-(--border-subtle) bg-(--surface-raised) text-(--text-secondary)",
  outline: "border-(--border-strong) bg-transparent text-(--text-secondary)"
};

export function Badge({
  className,
  variant = "secondary",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: BadgeVariant }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        badgeVariantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
