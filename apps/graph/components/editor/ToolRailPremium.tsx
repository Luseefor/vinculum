"use client";

import ToolRail from "@/components/editor/ToolRail";

type ToolId = "pan" | "probe" | "measureDistance" | "measureAngle" | "addPin" | "draw";

interface ToolRailPremiumProps {
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
  onResetView: () => void;
}

export default function ToolRailPremium(props: ToolRailPremiumProps) {
  return <ToolRail {...props} />;
}
