"use client";

import { Panel } from "@/components/showcase/ui";
import type { CSSProperties } from "react";
import type { AccentPreset } from "@/types/graphUi";

interface LivePreviewCardProps {
  accentPreset: AccentPreset;
}

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

export default function LivePreviewCard({ accentPreset }: LivePreviewCardProps) {
  const accent = accentHex[accentPreset];
  const previewStyle = { "--live-accent": accent } as CSSProperties;

  return (
    <Panel className="details-card">
      <h3>LIVE PREVIEW</h3>
      <div className="live-preview-shell" style={previewStyle}>
        <div className="live-preview-top" />
        <div className="live-preview-body">
          <div className="live-preview-2d" />
          <div className="live-preview-3d" />
        </div>
        <div className="live-preview-bottom">
          <span />
          <span />
          <span />
        </div>
      </div>
    </Panel>
  );
}
