import type { GraphObject } from "@vinculum/scene/types";
import type { Axis2DPair, Viewport2D, Viewport2DFrame } from "@/types/graphUi";
import { sanitizeViewportScale } from "@/lib/graph/viewport";
import { getEffectiveSurfaceOrientation } from "@/lib/math/expressions/surfaceExpressionOrientation";
import { computeGlyphLength } from "@/lib/math/fields/vectorFieldGlyphs";
import { buildRenderableGraphsFromScene } from "./buildRenderableGraphsFromScene";
import { getAxisPairSpec } from "./graph2dCanvasAxis";
import { drawImplicitContour } from "./graph2dCanvasImplicitDraw";

/** Bounded fit: finite geometry uses its samples; unbounded relations use the current window. */
export function fitGraph2dViewport(objects: GraphObject[], pair: Axis2DPair, params: Record<string, number>, current: Viewport2D, frame: Viewport2DFrame, selectedId?: string) {
  if (!(frame.width > 0 && frame.height > 0 && current.scale > 0)) return null;
  const spec = getAxisPairSpec(pair);
  const candidates = selectedId ? objects.filter(object => object.id === selectedId) : objects;
  const byId = new Map(candidates.map(object => [object.id, object]));
  const graphs = buildRenderableGraphsFromScene(candidates, spec, params);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, sampled = false;
  const add = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e12 || Math.abs(y) > 1e12) return;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  const window = { hMin: current.centerX - frame.width / (2 * current.scale), hMax: current.centerX + frame.width / (2 * current.scale), vMin: current.centerY - frame.height / (2 * current.scale), vMax: current.centerY + frame.height / (2 * current.scale) };
  for (const graph of graphs) {
    const object = byId.get(graph.id);
    let domain = window;
    if (object?.kind === "implicitSurface") {
      const d = object.domain;
      const ranges = { x: [d.xMin, d.xMax], y: [d.yMin, d.yMax], z: [d.zMin, d.zMax] };
      domain = { hMin: ranges[spec.horizontal][0], hMax: ranges[spec.horizontal][1], vMin: ranges[spec.vertical][0], vMax: ranges[spec.vertical][1] };
    } else if (object?.kind === "surface" && !(object.autoDomain ?? object.autoExpression)) {
      const dependent = getEffectiveSurfaceOrientation(object.equation, object.orientation).effectiveOrientation;
      const inputs = dependent === "x" ? ["y", "z"] : dependent === "y" ? ["x", "z"] : ["x", "y"];
      const ranges = [[object.domain.xMin, object.domain.xMax], [object.domain.yMin, object.domain.yMax]];
      domain = { ...window };
      for (const [axis, keys] of [[spec.horizontal, ["hMin", "hMax"]], [spec.vertical, ["vMin", "vMax"]]] as const) {
        const index = inputs.indexOf(axis);
        if (index >= 0) { domain[keys[0]] = ranges[index][0]; domain[keys[1]] = ranges[index][1]; }
      }
    } else if (graph.evaluate || graph.implicitEvaluate || graph.coplanarSurface || graph.verticalLineValue !== null || graph.horizontalLineValue !== null) sampled = true;
    if (graph.analysisPoints) graph.analysisPoints.forEach(point => add(point.x, point.y));
    if (graph.polylineHV) {
      const { points, connectedSegments } = graph.polylineHV;
      for (let i = 0; i < connectedSegments.length; i++) if (connectedSegments[i]) {
        add(points[2 * i], points[2 * i + 1]); add(points[2 * i + 2], points[2 * i + 3]);
      }
    }
    if (graph.meshXY) for (const index of graph.meshXY.indices) add(graph.meshXY.points[index * 2], graph.meshXY.points[index * 2 + 1]);
    if (graph.vectorField) {
      const field = graph.vectorField;
      for (let i = 0; i < field.count; i++) {
        const length = computeGlyphLength(field.magnitudes[i], field.maxMagnitude, field.cell, field.scale, field.normalize);
        add(field.bases[2 * i], field.bases[2 * i + 1]);
        add(field.bases[2 * i] + field.directions[2 * i] * length, field.bases[2 * i + 1] + field.directions[2 * i + 1] * length);
      }
    }
    if (graph.linearTransform) {
      const [a, b, c, d] = graph.linearTransform.matrix;
      [[0, 0], [1, 1], [a, c], [b, d], [a + b, c + d]].forEach(([x, y]) => add(x, y));
    }
    if (graph.hatchDomain || graph.coplanarSurface) {
      const d = graph.hatchDomain ?? domain; add(d.hMin, d.vMin); add(d.hMax, d.vMax);
    }
    if (graph.verticalLineValue !== null) { add(graph.verticalLineValue, domain.vMin); add(graph.verticalLineValue, domain.vMax); }
    if (graph.horizontalLineValue !== null) { add(domain.hMin, graph.horizontalLineValue); add(domain.hMax, graph.horizontalLineValue); }
    if (graph.evaluate) for (let i = 0; i <= 512; i++) {
      const t = graph.swapAxes ? domain.vMin + (domain.vMax - domain.vMin) * i / 512 : domain.hMin + (domain.hMax - domain.hMin) * i / 512;
      const value = graph.evaluate(t);
      if (value !== null) add(graph.swapAxes ? value : t, graph.swapAxes ? t : value);
    }
    if (graph.implicitEvaluate) {
      const dx = Math.max(1e-8, Math.abs(domain.hMax - domain.hMin)), dy = Math.max(1e-8, Math.abs(domain.vMax - domain.vMin));
      const scale = 384 / Math.max(dx, dy), width = dx * scale, height = dy * scale;
      const centerX = (domain.hMin + domain.hMax) / 2, centerY = (domain.vMin + domain.vMax) / 2;
      const point = (x: number, y: number) => add((x - width / 2) / scale + centerX, -(y - height / 2) / scale + centerY);
      drawImplicitContour(graph.implicitEvaluate, { moveTo: point, lineTo: point }, { width, height, scale, centerX, centerY }, width, height);
    }
  }
  if (![minX, maxX, minY, maxY].every(Number.isFinite)) return null;
  const spanX = Math.max(1e-4, maxX - minX), spanY = Math.max(1e-4, maxY - minY);
  const pointOnly = spanX === 1e-4 && spanY === 1e-4;
  return { viewport: { centerX: minX + (maxX - minX) / 2, centerY: minY + (maxY - minY) / 2,
    scale: pointOnly ? current.scale : sanitizeViewportScale(Math.min(frame.width / spanX, frame.height / spanY) * .8) }, sampled };
}
