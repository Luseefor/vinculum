"use client";

import type { Axis2DPair, Canvas2DTool } from "@/types/graphUi";
import { format2dGraphPlaneLabel } from "@/components/viewport/viewportLabelFormat";
import { cn } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { revealObjectInViewport } from "@/lib/objects/objectCreation";

function toolShortLabel(tool: Canvas2DTool): string {
  if (tool === "measureDistance") return "Distance";
  if (tool === "measureAngle") return "Angle";
  if (tool === "addPin") return "Pin";
  if (tool === "draw") return "Sketch";
  if (tool === "probe") return "Probe";
  return "Pan";
}

export type Graph2DCanvasUiTopIdentityProps = {
  pairForCanvas: Axis2DPair;
  canvas2dTool: Canvas2DTool;
  isQuadTop?: boolean;
};

export function Graph2DCanvasUiTopIdentity({ pairForCanvas, canvas2dTool, isQuadTop = false }: Graph2DCanvasUiTopIdentityProps) {
  const plane = format2dGraphPlaneLabel(pairForCanvas);
  // Pane names only disambiguate multi-pane layouts (the toolbar already names
  // a single view); the tool pill only appears for non-default modes.
  const multiPane = useEditorStore((state) => state.viewportMode === "split" || state.viewportMode === "quad");
  const hasSlice = useGraphStore(state => state.scene.objects.some(object => object.visible && ((object.kind === "parametricSurface" && object.dimension !== "2d") || (object.kind === "implicitSurface" || object.kind === "surface" || object.kind === "plane") && Boolean(object.equation.trim()))));
  const hasGeometrySlice = useGraphStore(state => state.scene.objects.some(object => object.visible && ["point", "vector", "line", "ray", "segment"].includes(object.kind)));
  const hasProjection = useGraphStore(state => state.scene.objects.some(object => object.visible && object.kind === "parametricCurve" && (object.dimension !== "2d" || pairForCanvas !== "xy")));
  const spatialOnly = useGraphStore(state => state.scene.objects.filter(object => object.visible && (object.kind === "vectorField" || object.kind === "linearTransform") && object.dimension === "3d").length);
  const xyOnly = useGraphStore(state => pairForCanvas !== "xy" && state.scene.objects.some(object => object.visible && (object.kind === "implicitCurve" || (object.kind === "linearTransform" || object.kind === "parametricSurface") && object.dimension === "2d")));
  const sliceAxis = pairForCanvas === "xy" ? "z" : pairForCanvas === "xz" ? "y" : "x";
  const showTool = canvas2dTool !== "pan";
  if (!multiPane && !showTool && !hasSlice && !hasGeometrySlice && !hasProjection && !spatialOnly && !xyOnly) {
    return null;
  }
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-3 top-3 z-25 flex max-w-[min(280px,calc(100%-4rem))] min-w-0 flex-col gap-1"
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-full border border-(--border-subtle) bg-(--surface-overlay) py-1 shadow-(--shadow-control)",
          multiPane || hasSlice || hasGeometrySlice || hasProjection || spatialOnly || xyOnly ? "pl-3" : "pl-1",
          showTool ? "pr-1" : "pr-3"
        )}
      >
        {multiPane || hasSlice || hasGeometrySlice || hasProjection || spatialOnly || xyOnly ? (
          <div className="min-w-0 truncate text-[12px] font-medium leading-tight text-(--text-primary)">
            2D Graph
            <span className="font-normal text-(--text-tertiary)"> · </span>
            <span className="text-(--text-secondary)">{plane}</span>
          </div>
        ) : null}
        {showTool ? (
          <span className="shrink-0 rounded-full bg-(--accent-soft) px-2 py-0.5 text-[11px] font-medium text-(--accent-ink)">
            {toolShortLabel(canvas2dTool)}
          </span>
        ) : null}
      </div>
      {hasSlice ? <span data-testid="implicit-slice-label" className="w-fit rounded-sm bg-(--surface-overlay) px-2 py-1 text-[11px] text-(--text-secondary)"> · Surface slice: {sliceAxis} = 0</span> : null}
      {hasGeometrySlice ? <div className="w-fit rounded-sm bg-(--surface-overlay) px-2 py-1 text-[11px] text-(--text-secondary)">
        <span data-testid="geometry-slice-label">Geometry intersections: {sliceAxis} = 0</span>
        {!multiPane && !spatialOnly ? <button type="button" className="pointer-events-auto ml-1 rounded-sm px-2 py-1 text-(--accent-ink) hover:bg-(--accent-soft) focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--accent)" onClick={() => {
          const object = useGraphStore.getState().scene.objects.find(entry => entry.visible && ["point", "vector", "line", "ray", "segment"].includes(entry.kind));
          if (object) revealObjectInViewport(object.id);
        }}>Show in 3D</button> : null}
      </div> : null}
      {hasProjection ? <span className="w-fit rounded-sm bg-(--surface-overlay) px-2 py-1 text-[11px] text-(--text-secondary)">Parametric curves projected onto {plane}</span> : null}
      {spatialOnly ? <div className="w-fit rounded-sm bg-(--surface-overlay) px-2 py-1 text-[11px] text-(--text-secondary)">
        <span data-testid="graph2d-spatial-only-note">{spatialOnly} {spatialOnly === 1 ? "object is" : "objects are"} shown in 3D only</span>
        {!multiPane ? <button type="button" className="pointer-events-auto ml-1 rounded-sm px-2 py-1 text-(--accent-ink) hover:bg-(--accent-soft) focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--accent)" onClick={() => {
          const object = useGraphStore.getState().scene.objects.find(entry => entry.visible && (entry.kind === "vectorField" || entry.kind === "linearTransform") && entry.dimension === "3d");
          if (object) revealObjectInViewport(object.id);
        }}>Show in 3D</button> : null}
      </div> : null}
      {xyOnly ? <div className="w-fit rounded-sm bg-(--surface-overlay) px-2 py-1 text-[11px] text-(--text-secondary)">
        <span data-testid="graph2d-xy-only-note">Planar equations, regions, and 2D transforms are shown on XY only</span>
        <button type="button" className="pointer-events-auto ml-1 rounded-sm px-2 py-1 text-(--accent-ink) hover:bg-(--accent-soft) focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--accent)" onClick={() => {
          const store = useGraphStore.getState();
          store.setActive2dViewport(isQuadTop ? "quadTop" : "primary");
          store.setAxis2DPair("xy");
        }}>Show on XY</button>
      </div> : null}
    </div>
  );
}
