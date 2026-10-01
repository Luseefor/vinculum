"use client";

import * as React from "react";
import { cn } from "@/components/ui/styles";

type ButtonVariant = "default" | "secondary" | "ghost" | "primary" | "shell" | "utility";
type ButtonSize = "default" | "sm" | "icon" | "xs";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isActive?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  default: "btn",
  secondary: "btn border bg-[var(--surface-raised)] border-[var(--border-strong)] text-[var(--text-primary)] shadow-[var(--shadow-control)] hover:bg-[var(--surface-bg)]",
  ghost: "btn border border-transparent bg-transparent shadow-none text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]",
  primary: "btn btn-primary shadow-sm hover:brightness-110 active:scale-[0.98]",
  shell: "btn bg-transparent border-transparent shadow-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)]/40",
  utility: "btn bg-[var(--surface-overlay)]/50 border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-overlay)]"
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-9 rounded-[var(--radius-md)] px-4 py-2 text-[13px]",
  sm: "h-8 rounded-[var(--radius-sm)] px-3 text-[12px]",
  xs: "h-6 rounded-[var(--radius-sm)] px-2 text-[11px]",
  icon: "h-8 w-8 rounded-[var(--radius-sm)] p-0 flex items-center justify-center"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "default", isActive, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        variantClasses[variant],
        sizeClasses[size],
        isActive && "ring-1 ring-[var(--accent-primary)] bg-[var(--surface-overlay)]",
        className
      )}
      {...props}
    />
  );
});
