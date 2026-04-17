"use client";

import { useEffect } from "react";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { useGraphStore } from "@/store/graphStore";

export default function ThemeSync() {
  const resolvedTheme = useResolvedTheme();
  const hydrateThemeMode = useGraphStore((state) => state.hydrateThemeMode);

  useEffect(() => {
    hydrateThemeMode();
  }, [hydrateThemeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return null;
}
