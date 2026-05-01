"use client";

import * as React from "react";
import { cn } from "@/components/ui/styles";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-7 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 text-[11px] font-semibold text-[var(--text-primary)] outline-none transition focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
