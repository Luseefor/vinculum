"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/components/ui/styles";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)]", className)} {...props} />;
}
