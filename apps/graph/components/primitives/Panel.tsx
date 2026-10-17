"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/components/ui/styles";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-(--border-subtle) bg-(--surface-raised)", className)} {...props} />;
}
