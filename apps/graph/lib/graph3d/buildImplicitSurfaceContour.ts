import { compile } from "mathjs";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial
} from "three";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import type { SurfaceGraphObject } from "@vinculum/scene/types";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { updateIndexAttributeUint32 } from "./bufferGeometryAttributes";
import { buildRibbonBuffersFromContourSegments } from "./implicitContourRibbonGeometry";
import { getUsedAxes, splitImplicitEquation } from "./implicitEquationParse";
import { marchImplicitContourSquares } from "./implicitContourMarching";

interface CompiledMathExpression {
  evaluate: (scope: Record<string, number>) => unknown;
}

export function buildImplicitSurfaceContour(
  object: SurfaceGraphObject,
  theme: ResolvedTheme
): Group | null {
  const parts = splitImplicitEquation(object.equation);
  if (!parts) {
    return null;
  }

  const expression = `(${parts.left}) - (${parts.right})`;
  let compiled: CompiledMathExpression;
  try {
    compiled = compile(expression) as CompiledMathExpression;
  } catch {
    return null;
  }

  const vars = getUsedAxes(expression);
  if (vars.length !== 2) {
    return null;
  }

  const missingAxis = (["x", "y", "z"] as const).find((axis) => !vars.includes(axis));
  if (!missingAxis) {
    return null;
  }

  const uAxis = vars[0];
  const vAxis = vars[1];
  const uMin = Math.min(object.domain.xMin, object.domain.xMax);
  const uMax = Math.max(object.domain.xMin, object.domain.xMax);
  const vMin = Math.min(object.domain.yMin, object.domain.yMax);
  const vMax = Math.max(object.domain.yMin, object.domain.yMax);
  const resolution = Math.max(24, Math.min(220, Math.floor(object.resolution)));
  const stepU = (uMax - uMin) / resolution;
  const stepV = (vMax - vMin) / resolution;
  if (!Number.isFinite(stepU) || !Number.isFinite(stepV) || stepU <= 0 || stepV <= 0) {
    return null;
  }

  const sample = (u: number, v: number): number | null => {
    try {
      const scope: Record<string, number> = {
        x: 0,
        y: 0,
        z: 0,
        pi: Math.PI,
        e: Math.E,
        ...getEditorParameterScope()
      };
      scope[uAxis] = u;
      scope[vAxis] = v;
      scope[missingAxis] = 0;
      const value = compiled.evaluate(scope);
      const numeric = typeof value === "number" ? value : Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    } catch {
      return null;
    }
  };

  const contourSegments = marchImplicitContourSquares(
    uMin,
    uMax,
    vMin,
    vMax,
    resolution,
    stepU,
    stepV,
    sample
  );

  if (contourSegments.length === 0) {
    return null;
  }

  const extent = Math.max(2, Math.max(Math.abs(uMin), Math.abs(uMax), Math.abs(vMin), Math.abs(vMax)));
  const wMin = -extent;
  const wMax = extent;
  const { edgePositions, fillPositions, fillIndices } = buildRibbonBuffersFromContourSegments(
    contourSegments,
    uAxis,
    vAxis,
    missingAxis,
    wMin,
    wMax
  );

  const group = new Group();
  group.userData.vinculumId = object.id;

  if (fillPositions.length > 0 && fillIndices.length > 0) {
    const fillGeometry = new BufferGeometry();
    fillGeometry.setAttribute("position", new BufferAttribute(new Float32Array(fillPositions), 3));
    updateIndexAttributeUint32(fillGeometry, new Uint32Array(fillIndices));
    fillGeometry.computeVertexNormals();
    fillGeometry.computeBoundingSphere();
    const fillMaterial = new MeshBasicMaterial({
      color: object.color,
      transparent: true,
      opacity: theme === "dark" ? 0.18 : 0.2,
      side: DoubleSide
    });
    const fillMesh = new Mesh(fillGeometry, fillMaterial);
    fillMesh.userData.vinculumId = object.id;
    group.add(fillMesh);
  }

  if (edgePositions.length > 0) {
    const edgeGeometry = new BufferGeometry();
    edgeGeometry.setAttribute("position", new BufferAttribute(new Float32Array(edgePositions), 3));
    edgeGeometry.computeBoundingSphere();
    const edgeMaterial = new LineBasicMaterial({
      color: object.color,
      transparent: true,
      opacity: theme === "dark" ? 0.92 : 0.88
    });
    const lines = new LineSegments(edgeGeometry, edgeMaterial);
    lines.userData.vinculumId = object.id;
    group.add(lines);
  }

  return group;
}
