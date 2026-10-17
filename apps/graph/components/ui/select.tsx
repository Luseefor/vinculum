"use client";

import * as React from "react";
import { cn } from "@/components/ui/styles";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-7 rounded-[var(--ui-radius-sm)] border border-(--border-strong) bg-(--surface-raised) px-2 text-[12px] font-medium text-(--text-primary) outline-hidden transition focus-visible:ring-2 focus-visible:ring-(--accent-soft) focus-visible:border-(--accent)",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
