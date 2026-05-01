"use client";

import { Panel, SwatchButton, ToggleGroup } from "@/components/showcase/ui";
import type { AccentPreset, UiDensity } from "@/types/graphUi";

interface CustomColorCardProps {
  accentPreset: AccentPreset;
  onAccentPresetChange: (accent: AccentPreset) => void;
  density: UiDensity;
  onDensityChange: (density: UiDensity) => void;
}

const primarySwatches = ["#4f46e5", "#6366f1", "#7c3aed", "#ec4899", "#ef4444", "#f59e0b", "#84cc16", "#14b8a6", "#0ea5e9"];

const accentMap: Array<{ id: AccentPreset; color: string }> = [
  { id: "indigo", color: "#6366f1" },
  { id: "violet", color: "#7c3aed" },
  { id: "pink", color: "#ec4899" },
  { id: "rose", color: "#f43f5e" },
  { id: "blue", color: "#0ea5e9" },
  { id: "cyan", color: "#14b8a6" },
  { id: "green", color: "#84cc16" },
  { id: "orange", color: "#f97316" },
  { id: "emerald", color: "#10b981" },
  { id: "amber", color: "#eab308" }
];

export default function CustomColorCard({ accentPreset, onAccentPresetChange, density, onDensityChange }: CustomColorCardProps) {
  return (
    <Panel className="details-card">
      <h3>CUSTOM COLOR (CSS VARIABLES)</h3>
      <div className="swatch-group">
        <p>Primary Color</p>
        <div className="swatch-row">
          {primarySwatches.map((color) => (
            <SwatchButton key={color} color={color} ariaLabel={`Primary ${color}`} />
          ))}
        </div>
      </div>
      <div className="swatch-group">
        <p>Accent Color</p>
        <div className="swatch-row">
          {accentMap.map((accent) => (
            <SwatchButton
              key={accent.id}
              color={accent.color}
              active={accentPreset === accent.id}
              ariaLabel={`Accent ${accent.id}`}
              onClick={() => onAccentPresetChange(accent.id)}
            />
          ))}
        </div>
      </div>
      <div className="density-group">
        <p>UI Density</p>
        <ToggleGroup
          size="sm"
          items={[
            { id: "comfortable", label: "Comfortable" },
            { id: "balanced", label: "Balanced" },
            { id: "compact", label: "Compact" }
          ]}
          activeId={density}
          onChange={(id) => onDensityChange(id as UiDensity)}
        />
      </div>
    </Panel>
  );
}
