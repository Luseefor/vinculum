"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/styles";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet({ open, onOpenChange, title, children }: SheetProps) {
  const asideRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<Element | null>(null);

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

  // Focus management: move focus into the dialog on open, trap Tab inside
  // while open, and restore focus to the trigger on close.
  useEffect(() => {
    if (!open) {
      return;
    }
    const aside = asideRef.current;
    if (!aside) {
      return;
    }
    restoreFocusRef.current = document.activeElement;
    const items = () =>
      [...aside.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
        (element) => !element.hasAttribute("disabled")
      );
    (items()[0] ?? aside).focus({ preventScroll: true });
    const onTrapTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }
      const focusables = items();
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0] as HTMLElement;
      const last = focusables[focusables.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    aside.addEventListener("keydown", onTrapTab);
    return () => {
      aside.removeEventListener("keydown", onTrapTab);
      const restoreTarget = restoreFocusRef.current;
      if (restoreTarget instanceof HTMLElement && aside.contains(document.activeElement)) {
        restoreTarget.focus({ preventScroll: true });
      }
      restoreFocusRef.current = null;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className={cn("fixed inset-0 z-50 block lg:hidden")}>
      <button
        type="button"
        className="absolute inset-0 bg-[var(--surface-backdrop)]"
        onClick={() => onOpenChange(false)}
        aria-label={`Close ${title} panel`}
        tabIndex={-1}
      />
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onOpenChange(false);
          }
        }}
        className="absolute right-0 top-0 h-full w-[24rem] max-w-[90vw] border-l border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-2xl"
      >
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
