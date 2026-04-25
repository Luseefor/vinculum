"use client";

import { Tabs } from "@/components/showcase/ui";

interface WorkspaceTabsProps {
  mode: "split" | "quad" | "single";
  onModeChange: (mode: "split" | "quad" | "single") => void;
}

export default function WorkspaceTabs({ mode, onModeChange }: WorkspaceTabsProps) {
  return (
    <div className="workspace-tabs-wrap">
      <Tabs
        className="workspace-tabs"
        tabs={[
          { id: "split", label: "SPLIT" },
          { id: "quad", label: "QUAD" },
          { id: "single", label: "SINGLE" }
        ]}
        activeTab={mode}
        onChange={(id) => onModeChange(id as "split" | "quad" | "single")}
      />
    </div>
  );
}
