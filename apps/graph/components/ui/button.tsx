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
  secondary: "btn border border-transparent bg-(--surface-muted) text-(--text-primary) enabled:hover:bg-(--surface-inset)",
  ghost: "btn border border-transparent bg-transparent shadow-none text-(--text-secondary) enabled:hover:bg-(--surface-muted) enabled:hover:text-(--text-primary)",
  primary: "btn btn-primary shadow-xs",
  shell: "btn bg-transparent border-transparent shadow-none text-(--text-secondary) enabled:hover:text-(--text-primary) enabled:hover:bg-(--surface-overlay)/40",
  utility: "btn bg-(--surface-overlay)/50 border-(--border-subtle) text-(--text-primary) enabled:hover:bg-(--surface-overlay)"
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-9 rounded-[var(--ui-radius-md)] px-4 py-2 text-[13px]",
  sm: "h-8 rounded-[var(--ui-radius-sm)] px-3 text-[12px]",
  xs: "h-6 rounded-[var(--ui-radius-sm)] px-2 text-[11px]",
  icon: "h-8 w-8 rounded-[var(--ui-radius-sm)] p-0 flex items-center justify-center"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "default", isActive, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={props["aria-pressed"] ?? isActive}
      className={cn(
        "outline-hidden focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-1 focus-visible:ring-offset-(--editor-chrome)",
        variantClasses[variant],
        sizeClasses[size],
        isActive && "ring-1 ring-(--accent-primary) bg-(--surface-overlay)",
        className
      )}
      {...props}
    />
  );
});
