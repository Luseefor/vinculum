"use client";

import CustomColorCard from "@/components/showcase/cards/CustomColorCard";
import CssVariablesCard from "@/components/showcase/cards/CssVariablesCard";
import LivePreviewCard from "@/components/showcase/cards/LivePreviewCard";
import ResizablePanelsCard from "@/components/showcase/cards/ResizablePanelsCard";
import ThemeSystemCard from "@/components/showcase/cards/ThemeSystemCard";
import type { AccentPreset, ThemeMode, UiDensity } from "@/types/graphUi";

interface DetailsGridProps {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  accentPreset: AccentPreset;
  onAccentPresetChange: (accent: AccentPreset) => void;
  density: UiDensity;
  onDensityChange: (density: UiDensity) => void;
}

export default function DetailsGrid({
  themeMode,
  onThemeModeChange,
  accentPreset,
  onAccentPresetChange,
  density,
  onDensityChange
}: DetailsGridProps) {
  return (
    <section className="details-grid" aria-label="Documentation cards">
      <ResizablePanelsCard />
      <ThemeSystemCard themeMode={themeMode} onThemeModeChange={onThemeModeChange} />
      <CustomColorCard
        accentPreset={accentPreset}
        onAccentPresetChange={onAccentPresetChange}
        density={density}
        onDensityChange={onDensityChange}
      />
      <LivePreviewCard accentPreset={accentPreset} />
      <CssVariablesCard />
    </section>
  );
}
