"use client";

import InspectorPanel from "@/components/layout/InspectorPanel";
import { useGraphStore } from "@/store/graphStore";

interface InspectorShellProps {
  width: number;
  onOpenExamples?: () => void;
}

export default function InspectorShell({ width, onOpenExamples }: InspectorShellProps) {
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const selectedMeasurementId = useGraphStore((state) => state.ui.selectedMeasurementId);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const canvas2dTool = useGraphStore((state) => state.ui.canvas2dTool);
  const canvas3dTool = useGraphStore((state) => state.ui.canvas3dTool);

  const activeTool = graphMode === "2d" ? canvas2dTool : canvas3dTool;
  const mode = selectedObjectId
    ? "object"
    : selectedMeasurementId
      ? "tool"
      : activeTool === "pan"
        ? "scene"
        : "tool";

  const activeToolLabel =
    selectedMeasurementId !== null
      ? "Measurement selected"
      : activeTool === "measureDistance"
        ? "Distance"
        : activeTool === "measureAngle"
          ? "Angle"
          : activeTool === "addPin"
            ? "Pin"
            : activeTool === "draw"
              ? "Sketch"
              : activeTool === "probe"
                ? "Probe"
                : "Pan";

  return <InspectorPanel width={width} mode={mode} activeToolLabel={activeToolLabel} onOpenExamples={onOpenExamples} />;
}
