"use client";

import { ThemePreviewCard, Panel, Switch } from "@/components/showcase/ui";
import type { ThemeMode } from "@/types/graphUi";

interface ThemeSystemCardProps {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}

export default function ThemeSystemCard({ themeMode, onThemeModeChange }: ThemeSystemCardProps) {
  return (
    <Panel className="details-card">
      <h3>THEME SYSTEM</h3>
      <p className="details-subtitle">Built-in Themes</p>
      <div className="theme-preview-row">
        <ThemePreviewCard mode="light" active={themeMode === "light"} onClick={() => onThemeModeChange("light")} />
        <ThemePreviewCard mode="dark" active={themeMode === "dark"} onClick={() => onThemeModeChange("dark")} />
      </div>
      <div className="theme-auto-row">
        <div>
          <p>Auto</p>
          <span>Follows system preference</span>
        </div>
        <Switch checked={themeMode === "system"} onCheckedChange={(checked) => onThemeModeChange(checked ? "system" : "dark")} />
      </div>
    </Panel>
  );
}
