"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { getFocusableWithin } from "@/lib/a11y/useDialogFocusTrap";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/styles";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}


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
    const items = () => getFocusableWithin(aside);
    (items()[0] ?? aside).focus({ preventScroll: true });
    // S34 PART 46/47: keep the focused field visible when the virtual
    // keyboard shrinks the viewport (and on plain focus changes) without a
    // custom keyboard detector — nearest-block scrolling only, no jumps.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        aside.contains(target) &&
        typeof target.scrollIntoView === "function"
      ) {
        // Nearest on both axes: never horizontal-jump wide matrix content.
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    aside.addEventListener("focusin", onFocusIn);
    // A keyboard can resize the viewport without causing another focus event.
    const onResize = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && aside.contains(active)) {
        active.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      }
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    const onTrapTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.defaultPrevented) {
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
      aside.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      // S34 PART 107: return focus to the trigger — unless focus already
      // moved into another still-mounted overlay (menu/dialog), which owns
      // it now. The unmount race (Chrome resets activeElement to body
      // during DOM removal) still restores correctly; a detached trigger
      // focus is a harmless no-op.
      const restoreTarget = restoreFocusRef.current;
      const active = document.activeElement;
      const inOtherOverlay =
        active instanceof HTMLElement && active.closest('[role="dialog"], [role="menu"]') !== null;
      if (restoreTarget instanceof HTMLElement && !inOtherOverlay) {
        restoreTarget.focus({ preventScroll: true });
      }
      restoreFocusRef.current = null;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    // S34-R11: no lg:hidden gate — mounting is composition-driven (compact
    // includes short landscape ≥1024px wide), so a CSS breakpoint would hide
    // a mounted, focus-trapped dialog. Callers render null outside compact.
    <div className={cn("sheet-viewport fixed inset-0 z-50 block")}>
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
        className="absolute right-0 top-0 flex h-full w-[24rem] max-w-[calc(100vw-16px)] flex-col rounded-l-[var(--radius-xl)] bg-[var(--editor-chrome)] shadow-[var(--shadow-floating)]"
      >
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[var(--text-secondary)]">{title}</h2>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
        {/* S34: the sheet owns vertical overflow so content scrolls even if
            a future child lacks its own scroller. */}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
