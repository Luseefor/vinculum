"use client";

import type { RefObject } from "react";
import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusableWithin(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    const ariaHidden = el.getAttribute("aria-hidden");
    if (ariaHidden === "true") return false;
    return true;
  });
}

export function useDialogFocusTrap(args: {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  /**
   * Optional: selector inside the container that should receive focus first.
   * If omitted, the hook will prefer `[data-autofocus="true"]`, then fall back
   * to the first focusable element.
   */
  initialFocusSelector?: string;
}) {
  const { open, containerRef, initialFocusSelector } = args;
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const autofocusEl =
      (initialFocusSelector
        ? container.querySelector<HTMLElement>(initialFocusSelector)
        : container.querySelector<HTMLElement>('[data-autofocus="true"]')) ?? null;

    const focusable = getFocusableWithin(container);
    const target = autofocusEl ?? focusable[0] ?? null;
    target?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      if (!containerRef.current) return;

      const focusable = getFocusableWithin(containerRef.current);
      if (focusable.length < 2) return;

      const active = document.activeElement as HTMLElement | null;
      if (!active || !containerRef.current.contains(active)) return;

      // In some test environments, focus may land on nested elements; map to the
      // nearest focusable container element so boundary comparisons are stable.
      const activeFocusable =
        focusable.find((el) => el === active) ?? focusable.find((el) => el.contains(active)) ?? active;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && activeFocusable === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeFocusable === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousActiveElementRef.current?.focus?.();
      previousActiveElementRef.current = null;
    };
  }, [open, containerRef, initialFocusSelector]);
}

