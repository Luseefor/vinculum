"use client";

import { useEffect } from "react";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { useGraphStore } from "@/store/graphStore";

export default function ThemeSync() {
  const resolvedTheme = useResolvedTheme();
  const hydrateThemeMode = useGraphStore((state) => state.hydrateThemeMode);
  const hydrateAccentPreset = useGraphStore((state) => state.hydrateAccentPreset);
  const hydrateDensity = useGraphStore((state) => state.hydrateDensity);
  const accentPreset = useGraphStore((state) => state.ui.accentPreset);
  const density = useGraphStore((state) => state.ui.density);

  useEffect(() => {
    void (async () => {
      await Promise.resolve(useGraphStore.persist.rehydrate());
      hydrateThemeMode();
      hydrateAccentPreset();
      hydrateDensity();
    })();
  }, [hydrateAccentPreset, hydrateDensity, hydrateThemeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accentPreset;
  }, [accentPreset]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.density = density;
  }, [density]);

  return null;
}
