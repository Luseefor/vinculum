"use client";

import * as React from "react";
import { cn } from "@/components/ui/styles";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-7 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2 text-[12px] font-medium text-[var(--text-primary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)] focus-visible:border-[var(--accent)]",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
