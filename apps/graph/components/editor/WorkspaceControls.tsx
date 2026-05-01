"use client";

import { cn } from "@/components/ui/styles";
import type { ReactNode } from "react";
import { SplitViewIcon, QuadViewIcon } from "@/components/layout/icons";

type AxisPair = "xy" | "xz" | "yz";
type MultiPanelLayout = "split" | "quad";
type ToolId = "pan" | "probe" | "measureDistance" | "measureAngle" | "addPin" | "draw";

interface WorkspaceControlsProps {
  graphMode: "2d" | "3d";
  onGraphModeChange: (mode: "2d" | "3d") => void;
  showAxisPair: boolean;
  planeSwitcherActivePair: AxisPair;
  onAxisPairChange: (pair: AxisPair) => void;
  showBaselinePlane: boolean;
  baseline3dPlane: AxisPair;
  onBaselinePlaneChange: (pair: AxisPair) => void;
  viewportMode: MultiPanelLayout;
  onViewportModeChange: (mode: MultiPanelLayout) => void;
  activeTool: ToolId;
  onActiveToolChange: (tool: ToolId) => void;
  onOpenInspector: () => void;
}

function Segmented({
  children
}: {
  children: ReactNode;
}) {
  return <div className="pointer-events-auto shrink-0 rounded-md border border-[var(--border-strong)] bg-[var(--editor-control)] p-0.5 shadow-sm">{children}</div>;
}

function SegmentedButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-[6px] px-2.5 text-[11px] font-semibold uppercase tracking-wide transition-all",
        active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
      )}
    >
      {children}
    </button>
  );
}

export default function WorkspaceControls({
  graphMode,
  onGraphModeChange,
  showAxisPair,
  planeSwitcherActivePair,
  onAxisPairChange,
  showBaselinePlane,
  baseline3dPlane,
  onBaselinePlaneChange,
  viewportMode,
  onViewportModeChange,
  activeTool,
  onActiveToolChange,
  onOpenInspector
}: WorkspaceControlsProps) {
  return (
    <>
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex max-w-[36%] items-center gap-2 overflow-x-auto">
        <Segmented>
          <SegmentedButton active={graphMode === "2d"} onClick={() => onGraphModeChange("2d")}>
            2D
          </SegmentedButton>
          <SegmentedButton active={graphMode === "3d"} onClick={() => onGraphModeChange("3d")}>
            3D
          </SegmentedButton>
        </Segmented>

        {showAxisPair ? (
          <Segmented>
            {(["xy", "xz", "yz"] as const).map((pair) => (
              <SegmentedButton key={pair} active={planeSwitcherActivePair === pair} onClick={() => onAxisPairChange(pair)}>
                {pair}
              </SegmentedButton>
            ))}
          </Segmented>
        ) : null}

        {showBaselinePlane ? (
          <Segmented>
            {(["xy", "xz", "yz"] as const).map((pair) => (
              <SegmentedButton key={pair} active={baseline3dPlane === pair} onClick={() => onBaselinePlaneChange(pair)}>
                B {pair}
              </SegmentedButton>
            ))}
          </Segmented>
        ) : null}
      </div>

      <div className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2">
        <Segmented>
          <SegmentedButton active={viewportMode === "split"} onClick={() => onViewportModeChange("split")}>
            <span className="flex items-center gap-1"><SplitViewIcon className="h-3.5 w-3.5" />Split</span>
          </SegmentedButton>
          <SegmentedButton active={viewportMode === "quad"} onClick={() => onViewportModeChange("quad")}>
            <span className="flex items-center gap-1"><QuadViewIcon className="h-3.5 w-3.5" />Quad</span>
          </SegmentedButton>
        </Segmented>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 z-20 flex max-w-[42%] items-center gap-2 overflow-x-auto">
        <Segmented>
          {(["pan", "probe", "measureDistance", "measureAngle", "addPin", "draw"] as const).map((tool) => (
            <SegmentedButton key={tool} active={activeTool === tool} onClick={() => onActiveToolChange(tool)}>
              {tool === "draw"
                ? "Sketch"
                : tool === "measureDistance"
                  ? "Distance"
                  : tool === "measureAngle"
                    ? "Angle"
                    : tool === "addPin"
                      ? "Pin"
                      : tool === "probe"
                        ? "Probe"
                        : "Pan"}
            </SegmentedButton>
          ))}
        </Segmented>
        <button
          onClick={onOpenInspector}
          className="pointer-events-auto ml-1 rounded-md border border-[var(--border-strong)] bg-[var(--editor-control)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)] lg:hidden"
        >
          Inspector
        </button>
      </div>
    </>
  );
}
