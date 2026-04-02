"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export const GRAPH_INTERACTION_EVENT = "vinculum:graph-interaction";
const INTERACTION_DEBOUNCE_MS = 150;

export function dispatchGraphInteractionEvent(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(GRAPH_INTERACTION_EVENT));
}

export function useAdaptiveResolution() {
  const [isInteractive, setIsInteractive] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const markInteractive = () => {
      setIsInteractive(true);

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setIsInteractive(false);
        timeoutRef.current = null;
      }, INTERACTION_DEBOUNCE_MS);
    };

    const handleGlobalInteraction = () => {
      markInteractive();
    };

    window.addEventListener(GRAPH_INTERACTION_EVENT, handleGlobalInteraction);

    return () => {
      window.removeEventListener(GRAPH_INTERACTION_EVENT, handleGlobalInteraction);

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Disabled adaptive resolution - always render at full quality to prevent flickering
  return {
    resolutionMultiplier: 1,
    isInteractive
  };
}

function isTextInputElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true;
  }

  return target.isContentEditable;
}
