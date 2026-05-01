"use client";

import { railIcon } from "@/components/showcase/icons";
import { IconButton } from "@/components/showcase/ui";

interface LeftRailProps {
  activeId: string;
  onSelect: (id: string) => void;
}

const topItems = [
  { id: "select", label: "Select" },
  { id: "link", label: "Connect" },
  { id: "cube", label: "Objects" },
  { id: "nodes", label: "Nodes" },
  { id: "chain", label: "Links" },
  { id: "sliders", label: "Controls" },
  { id: "gear", label: "Settings" }
];

const bottomItems = [
  { id: "help", label: "Help" },
  { id: "moon", label: "Theme" }
];

export default function LeftRail({ activeId, onSelect }: LeftRailProps) {
  return (
    <aside className="left-rail" aria-label="Left rail">
      <div className="left-rail-stack">
        {topItems.map((item) => (
          <IconButton
            key={item.id}
            icon={<span className="icon-16">{railIcon(item.id)}</span>}
            className="left-rail-btn"
            active={activeId === item.id}
            ariaLabel={item.label}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
      <div className="left-rail-stack">
        {bottomItems.map((item) => (
          <IconButton
            key={item.id}
            icon={<span className="icon-16">{railIcon(item.id)}</span>}
            className="left-rail-btn"
            active={activeId === item.id}
            ariaLabel={item.label}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </aside>
  );
}
