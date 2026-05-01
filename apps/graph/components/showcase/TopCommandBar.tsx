"use client";

import { useMemo, useState } from "react";
import { Badge, Button, IconButton, SwatchButton, Switch, ToggleGroup } from "@/components/showcase/ui";
import { IconChevronDown, IconGrid, IconMore, IconSplit, IconSun, IconVLogo } from "@/components/showcase/icons";
import type { AccentPreset, GraphMode, ThemeMode, UiDensity } from "@/types/graphUi";

interface TopCommandBarProps {
  mode: GraphMode;
  onModeChange: (mode: GraphMode) => void;
  tool: "pan" | "probe" | "draw";
  onToolChange: (tool: "pan" | "probe" | "draw") => void;
  snapEnabled: boolean;
  onSnapEnabledChange: (enabled: boolean) => void;
  snapStep: number;
  onSnapStepChange: (value: number) => void;
  viewportMode: "split" | "quad" | "single";
  onViewportModeChange: (mode: "split" | "quad" | "single") => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  density: UiDensity;
  onDensityChange: (density: UiDensity) => void;
  accentPreset: AccentPreset;
  onAccentPresetChange: (accent: AccentPreset) => void;
  onNewScene: () => void;
  onImportScene: () => void;
  onExportScene: () => void;
  onResetView: () => void;
}

const accentOptions: AccentPreset[] = ["indigo", "violet", "pink", "rose", "orange", "amber", "green", "emerald", "cyan", "blue"];
const accentHex: Record<AccentPreset, string> = {
  indigo: "#6366f1",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  emerald: "#10b981",
  green: "#84cc16",
  amber: "#eab308",
  orange: "#f97316",
  rose: "#f43f5e",
  pink: "#ec4899",
  violet: "#7c3aed"
};

export default function TopCommandBar({
  mode,
  onModeChange,
  tool,
  onToolChange,
  snapEnabled,
  onSnapEnabledChange,
  snapStep,
  onSnapStepChange,
  viewportMode,
  onViewportModeChange,
  themeMode,
  onThemeModeChange,
  density,
  onDensityChange,
  accentPreset,
  onAccentPresetChange,
  onNewScene,
  onImportScene,
  onExportScene,
  onResetView
}: TopCommandBarProps) {
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const normalizedStep = useMemo(() => {
    if (!Number.isFinite(snapStep)) {
      return "0.25";
    }
    return snapStep.toFixed(2);
  }, [snapStep]);

  return (
    <header className="top-command-bar" data-top-command-bar="true">
      <div className="brand-wrap">
        <span className="brand-icon" aria-hidden="true">
          <IconVLogo />
        </span>
        <h1 className="brand-title">Vinculum</h1>
      </div>

      <ToggleGroup
        size="sm"
        ariaLabel="Graph mode"
        className="toolbar-segment"
        items={[
          { id: "2d", label: "2D" },
          { id: "3d", label: "3D" }
        ]}
        activeId={mode}
        onChange={(id) => onModeChange(id === "2d" ? "2d" : "3d")}
      />

      <Badge className="toolbar-object-badge">12 objects</Badge>

      <span className="toolbar-divider" aria-hidden="true" />

      <div className="toolbar-group" data-testid="toolbar-3d-tools">
        <span className="toolbar-label">Tools</span>
        <ToggleGroup
          size="sm"
          className="toolbar-segment"
          items={[
            { id: "pan", label: "Pan" },
            { id: "probe", label: "Probe" },
            { id: "draw", label: "Sketch" }
          ]}
          activeId={tool}
          onChange={(id) => onToolChange(id as "pan" | "probe" | "draw")}
        />
      </div>

      <Switch
        checked={snapEnabled}
        onCheckedChange={onSnapEnabledChange}
        label={<span className="snap-label">Snap</span>}
        ariaLabel="Snap"
        className="snap-switch"
      />

      <input
        className="step-input"
        type="number"
        value={normalizedStep}
        onChange={(event) => onSnapStepChange(Number(event.target.value))}
      />

      <span className="toolbar-divider" aria-hidden="true" />

      <Button className="v-btn-sm toolbar-select" ariaLabel="Light mode selector">
        Light
        <span className="icon-14">
          <IconChevronDown />
        </span>
      </Button>

      <IconButton
        icon={<span className="icon-14"><IconSun /></span>}
        className="v-btn-sm"
        ariaLabel="Appearance"
        onClick={() => setAppearanceOpen((open) => !open)}
      />

      <div className="toolbar-segment toolbar-view-modes" role="group" aria-label="Workspace mode">
        <IconButton
          icon={<span className="icon-14"><IconSplit /></span>}
          className="v-btn-sm"
          active={viewportMode === "split"}
          ariaLabel="Split layout"
          onClick={() => onViewportModeChange("split")}
        />
        <IconButton
          icon={<span className="icon-14"><IconGrid /></span>}
          className="v-btn-sm"
          active={viewportMode === "single"}
          ariaLabel="Single layout"
          onClick={() => onViewportModeChange("single")}
        />
        <IconButton
          icon={<span className="icon-14"><IconGrid /></span>}
          className="v-btn-sm"
          active={viewportMode === "quad"}
          ariaLabel="Quad layout"
          onClick={() => onViewportModeChange("quad")}
        />
        <IconButton icon={<span className="icon-14"><IconMore /></span>} className="v-btn-sm" ariaLabel="More layouts" />
      </div>

      <span className="toolbar-divider" aria-hidden="true" />

      <div className="toolbar-file-group">
        <Button className="v-btn-sm toolbar-select" onClick={onNewScene}>
          New
          <span className="icon-14">
            <IconChevronDown />
          </span>
        </Button>
        <Button className="v-btn-sm" onClick={onImportScene}>Import</Button>
        <Button className="v-btn-sm" onClick={onExportScene}>Export</Button>
        <Button className="v-btn-sm" onClick={onResetView}>Reset</Button>
      </div>

      <span className="toolbar-avatar" aria-hidden="true">U</span>

      {appearanceOpen ? (
        <div className="appearance-popover" role="dialog" aria-label="Appearance controls">
          <div className="appearance-block">
            <p>Theme</p>
            <div className="appearance-inline">
              {([
                ["light", "Light"],
                ["dark", "Dark"],
                ["system", "Auto"]
              ] as const).map(([id, label]) => (
                <Button
                  key={id}
                  className="v-btn-sm"
                  active={themeMode === id}
                  onClick={() => onThemeModeChange(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="appearance-block">
            <p>Accent</p>
            <div className="appearance-swatches">
              {accentOptions.map((preset) => (
                <SwatchButton
                  key={preset}
                  color={accentHex[preset]}
                  active={accentPreset === preset}
                  ariaLabel={`Accent ${preset}`}
                  onClick={() => onAccentPresetChange(preset)}
                />
              ))}
            </div>
          </div>
          <div className="appearance-block">
            <p>Density</p>
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
        </div>
      ) : null}
    </header>
  );
}
