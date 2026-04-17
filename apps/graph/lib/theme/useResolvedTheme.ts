"use client";

import { useEffect, useMemo, useState } from "react";
import { useGraphStore } from "@/store/graphStore";
import { resolveTheme, type ResolvedTheme } from "./resolveTheme";

export function useResolvedTheme(): ResolvedTheme {
  const themeMode = useGraphStore((state) => state.ui.themeMode);
  const [prefersDark, setPrefersDark] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setPrefersDark(event.matches);

    setPrefersDark(mediaQuery.matches);
    mediaQuery.addEventListener("change", listener);

    return () => {
      mediaQuery.removeEventListener("change", listener);
    };
  }, []);

  return useMemo(() => resolveTheme(themeMode, prefersDark), [themeMode, prefersDark]);
}
