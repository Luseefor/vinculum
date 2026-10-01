"use client";

import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SlidersIcon } from "@/components/layout/icons";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import type { Axis2DPair } from "@/types/graphUi";
import type { GeometryLayout, GeometryView } from "@/lib/types/ui";
import { cn } from "@/components/ui/styles";

export type ViewTool = "select" | "pan" | "probe" | "addPin" | "measureDistance" | "measureAngle" | "draw";

export interface ViewControlsProps {
  activeViewType?: "2d" | "3d" | "both";
  onViewTypeChange?: (view: "2d" | "3d" | "both") => void;
  activeLayout?: "split" | "quad";
  onLayoutChange?: (layout: "split" | "quad") => void;
  plane2d?: Axis2DPair;
  onPlane2dChange?: (pair: Axis2DPair) => void;
  base3d?: Axis2DPair;
  onBase3dChange?: (pair: Axis2DPair) => void;
  activeToolLabel?: ViewTool;
  onToolChange?: (tool: ViewTool) => void;
}

const GROUP =
  "flex h-8 shrink-0 items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-0.5 shadow-[var(--shadow-control)]";

function segmentClass(active: boolean, emphasis: "primary" | "secondary" = "primary"): string {
  return cn(
    "h-7 rounded-[var(--radius-sm)] px-2.5 text-[12px] font-medium outline-none transition-colors duration-[var(--motion-fast)] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
    active
      ? emphasis === "primary"
        ? "bg-[var(--accent-solid)] text-white shadow-[var(--shadow-control)]"
        : "bg-[var(--surface-muted)] text-[var(--text-primary)]"
      : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
  );
}

function PillSelect({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] pl-2.5 pr-1 text-[12px] text-[var(--text-tertiary)] shadow-[var(--shadow-control)] transition-colors focus-within:border-[var(--accent)] hover:border-[var(--border-strong)]">
      {label}
      <select
        {...props}
        className="h-7 cursor-pointer rounded-[var(--radius-sm)] border-0 bg-transparent pl-0.5 pr-1 text-[12px] font-medium text-[var(--text-primary)] outline-none"
      >
        {children}
      </select>
    </label>
  );
}

/**
 * Canvas view controls (view type, layout, planes, active tool). One
 * instance is mounted per composition: floating over the canvas on wide
 * layouts, in the secondary bar on compact ones.
 */
export default function ViewControls({
  activeViewType = "3d",
  onViewTypeChange = () => {},
  activeLayout = "split",
  onLayoutChange = () => {},
  plane2d = "xy",
  onPlane2dChange = () => {},
  base3d = "xy",
  onBase3dChange = () => {},
  activeToolLabel = "pan",
  onToolChange = () => {}
}: ViewControlsProps) {
  const workspace = useGraphStore((state) => state.ui.workspace);
  const geometryLayout = useEditorStore((state) => state.geometryLayout);
  const geometryView = useEditorStore((state) => state.geometryView);
  const geometrySplitView = useEditorStore((state) => state.geometrySplitView);
  const setGeometryLayout = useEditorStore((state) => state.setGeometryLayout);
  const setGeometryView = useEditorStore((state) => state.setGeometryView);
  const setGeometrySplitView = useEditorStore((state) => state.setGeometrySplitView);

  return (
    <div className="flex w-max items-center gap-1.5">
      {workspace === "geometry" ? (
        <>
          <PillSelect
            label="View"
            data-testid="toolbar-geometry-view-select"
            aria-label="Geometry view"
            value={geometryView}
            onChange={(event) => setGeometryView(event.target.value as GeometryView)}
          >
            <option value="perspective">Perspective</option>
            <option value="xy">XY</option>
            <option value="xz">XZ</option>
            <option value="yz">YZ</option>
          </PillSelect>
          <PillSelect
            label="Layout"
            data-testid="toolbar-geometry-layout-select"
            aria-label="Geometry layout"
            value={geometryLayout}
            onChange={(event) => setGeometryLayout(event.target.value as GeometryLayout)}
          >
            <option value="single">Single</option>
            <option value="split">Split</option>
            <option value="quad">Quad</option>
          </PillSelect>
          {geometryLayout === "split" ? (
            <PillSelect
              label="Split view"
              data-testid="toolbar-geometry-split-select"
              aria-label="Split view"
              value={geometrySplitView}
              onChange={(event) => setGeometrySplitView(event.target.value as GeometryView)}
            >
              <option value="xy">XY</option>
              <option value="xz">XZ</option>
              <option value="yz">YZ</option>
            </PillSelect>
          ) : null}
        </>
      ) : (
        <>
          <div className={GROUP} role="group" aria-label="View type">
            {(["2d", "3d", "both"] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={activeViewType === id}
                aria-label={id === "both" ? "2D and 3D together" : `${id.toUpperCase()} only`}
                onClick={() => onViewTypeChange(id)}
                className={segmentClass(activeViewType === id)}
              >
                {id === "both" ? "2D + 3D" : id.toUpperCase()}
              </button>
            ))}
          </div>
          {activeViewType === "both" ? (
            <div className={GROUP} role="group" aria-label="Multi-panel layout">
              {(["split", "quad"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={activeLayout === id}
                  aria-label={id === "split" ? "Side-by-side layout" : "Four-panel layout"}
                  onClick={() => onLayoutChange(id)}
                  className={segmentClass(activeLayout === id, "secondary")}
                >
                  {id === "split" ? "Split" : "Quad"}
                </button>
              ))}
            </div>
          ) : null}
          <ViewOptions>
            {activeViewType !== "3d" ? (
              <PillSelect
                label="2D plane"
                data-testid="toolbar-2d-plane-select"
                aria-label="2D Plane"
                value={plane2d}
                onChange={(event) => onPlane2dChange(event.target.value as Axis2DPair)}
              >
                <option value="xy">XY</option>
                <option value="xz">XZ</option>
                <option value="yz">YZ</option>
              </PillSelect>
            ) : null}
            {activeViewType !== "2d" ? (
              <PillSelect
                label="3D base"
                data-testid="toolbar-3d-base-select"
                aria-label="3D Base"
                value={base3d}
                onChange={(event) => onBase3dChange(event.target.value as Axis2DPair)}
              >
                <option value="xy">Base XY</option>
                <option value="xz">Base XZ</option>
                <option value="yz">Base YZ</option>
              </PillSelect>
            ) : null}
          </ViewOptions>
        </>
      )}
      <PillSelect
        label="Tool"
        aria-label="Tool"
        value={activeToolLabel === "select" ? "probe" : activeToolLabel}
        onChange={(event) => onToolChange(event.target.value as ViewTool)}
      >
        <option value="pan">Pan</option>
        <option value="probe">Probe</option>
        <option value="addPin">Pin</option>
        <option value="measureDistance">Distance</option>
        <option value="measureAngle">Angle</option>
        <option value="draw">Sketch</option>
      </PillSelect>
    </div>
  );
}

// Plane/base orientation is set once per session at most, so it sits one
// click away instead of competing with the view type for toolbar space.
function ViewOptions({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        {(props) => (
          <button
            ref={props.ref as never}
            type="button"
            aria-label="View options"
            title="View options"
            aria-expanded={props["aria-expanded"]}
            aria-controls={props["aria-controls"]}
            aria-haspopup={props["aria-haspopup"]}
            onClick={props.onClick}
            onKeyDown={props.onKeyDown}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-secondary)] outline-none transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
              open && "bg-[var(--surface-muted)] text-[var(--text-primary)]"
            )}
          >
            <SlidersIcon className="h-4 w-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="flex flex-col gap-2 [&>label]:w-full [&>label]:justify-between">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
