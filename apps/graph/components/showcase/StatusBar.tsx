"use client";

import { Badge } from "@/components/showcase/ui";

interface StatusBarProps {
  snapStep: number;
}

export default function StatusBar({ snapStep }: StatusBarProps) {
  return (
    <footer className="app-status-bar" aria-label="Status bar">
      <div className="status-left">
        <Badge>3D</Badge>
        <Badge>12 visible</Badge>
        <Badge>Snap: On ({snapStep.toFixed(2)})</Badge>
      </div>
      <p className="status-hint">Hotkeys: 1/2/3/4 views · V pan · P probe · S sketch · X snap · Cmd/Ctrl+K palette</p>
      <span className="status-dot" aria-hidden="true" />
    </footer>
  );
}
