"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export const GRAPH_INTERACTION_EVENT = "vinculum:graph-interaction";
const INTERACTION_DEBOUNCE_MS = 300;
const INTERACTIVE_RESOLUTION_MULTIPLIER = 0.5;

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

    const handleTyping = (event: Event) => {
      const target = event.target;
      if (!isTextInputElement(target)) {
        return;
      }

      markInteractive();
    };

    window.addEventListener(GRAPH_INTERACTION_EVENT, handleGlobalInteraction);
    document.addEventListener("keydown", handleTyping, true);
    document.addEventListener("input", handleTyping, true);

    return () => {
      window.removeEventListener(GRAPH_INTERACTION_EVENT, handleGlobalInteraction);
      document.removeEventListener("keydown", handleTyping, true);
      document.removeEventListener("input", handleTyping, true);

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const resolutionMultiplier = useMemo(
    () => (isInteractive ? INTERACTIVE_RESOLUTION_MULTIPLIER : 1),
    [isInteractive]
  );

  return {
    resolutionMultiplier,
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
