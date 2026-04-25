"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/styles";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

export function Sheet({ open, onOpenChange, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onOpenChange, open]);

  return (
    <div className={cn("fixed inset-0 z-50 hidden", open && "block lg:hidden")}>
      <button
        type="button"
        className="absolute inset-0 bg-[var(--surface-backdrop)]"
        onClick={() => onOpenChange(false)}
        aria-label="Close inspector panel"
      />
      <aside className="absolute right-0 top-0 h-full w-[24rem] max-w-[90vw] border-l border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
          <h2 className="text-xs font-semibold tracking-[0.08em] text-[var(--text-secondary)]">{title}</h2>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
        <div className="h-[calc(100%-41px)]">{children}</div>
      </aside>
    </div>
  );
}
