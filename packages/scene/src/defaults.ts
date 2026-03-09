import type {
  ParametricCurveObject,
  PlaneAppearance,
  PlaneGraphObject,
  SurfaceAppearance,
  SurfaceDomain,
  SurfaceGraphObject
} from "./types";

export const defaultGraphPalette = ["#2d70b3", "#388c46", "#c74440", "#6042a6", "#fa7e19"];

export function pickDefaultGraphColor(index = 0): string {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return defaultGraphPalette[safeIndex % defaultGraphPalette.length];
}

export const defaultSurfaceDomain: SurfaceDomain = {
  xMin: -5,
  xMax: 5,
  yMin: -5,
  yMax: 5
};

export const defaultSurfaceResolution = 80;
export const defaultSurfaceEquation = "sin(x) * cos(y)";

export const defaultCurveExpressions = {
  xExpr: "cos(t)",
  yExpr: "sin(t)",
  zExpr: "t / 3"
};

export const defaultCurveRange = {
  tMin: -6.2831853072,
  tMax: 6.2831853072
};

export const defaultCurveSamples = 220;

export const defaultPlaneEquation = "x + y + z - 1 = 0";
export const defaultPlaneSize = 12;

const defaultSurfaceAppearance: SurfaceAppearance = {
  wireframe: false
};

const defaultPlaneAppearance: PlaneAppearance = {
  wireframe: false
};

interface CreateDefaultSurfaceGraphOptions {
  id: string;
  index?: number;
  equation?: string;
  visible?: boolean;
  color?: string;
  domain?: Partial<SurfaceDomain>;
  resolution?: number;
  appearance?: Partial<SurfaceAppearance>;
}

interface CreateDefaultParametricCurveOptions {
  id: string;
  index?: number;
  xExpr?: string;
  yExpr?: string;
  zExpr?: string;
  tMin?: number;
  tMax?: number;
  samples?: number;
  visible?: boolean;
  color?: string;
}

interface CreateDefaultPlaneGraphOptions {
  id: string;
  index?: number;
  equation?: string;
  size?: number;
  visible?: boolean;
  color?: string;
  appearance?: Partial<PlaneAppearance>;
}

export function createDefaultSurfaceGraph(options: CreateDefaultSurfaceGraphOptions): SurfaceGraphObject {
  const baseDomain = {
    ...defaultSurfaceDomain,
    ...options.domain
  };

  return {
    id: options.id,
    kind: "surface",
    equation: options.equation ?? defaultSurfaceEquation,
    visible: options.visible ?? true,
    color: options.color ?? pickDefaultGraphColor(options.index),
    domain: {
      xMin: baseDomain.xMin,
      xMax: baseDomain.xMax,
      yMin: baseDomain.yMin,
      yMax: baseDomain.yMax
    },
    resolution: Math.max(2, Math.floor(options.resolution ?? defaultSurfaceResolution)),
    appearance: {
      ...defaultSurfaceAppearance,
      ...options.appearance
    }
  };
}

export function createDefaultParametricCurve(options: CreateDefaultParametricCurveOptions): ParametricCurveObject {
  return {
    id: options.id,
    kind: "parametricCurve",
    xExpr: options.xExpr ?? defaultCurveExpressions.xExpr,
    yExpr: options.yExpr ?? defaultCurveExpressions.yExpr,
    zExpr: options.zExpr ?? defaultCurveExpressions.zExpr,
    tMin: Number.isFinite(options.tMin) ? (options.tMin as number) : defaultCurveRange.tMin,
    tMax: Number.isFinite(options.tMax) ? (options.tMax as number) : defaultCurveRange.tMax,
    samples: Math.max(2, Math.floor(options.samples ?? defaultCurveSamples)),
    visible: options.visible ?? true,
    color: options.color ?? pickDefaultGraphColor(options.index)
  };
}

export function createDefaultPlaneGraph(options: CreateDefaultPlaneGraphOptions): PlaneGraphObject {
  return {
    id: options.id,
    kind: "plane",
    equation: options.equation ?? defaultPlaneEquation,
    size: Math.max(1, Math.floor(options.size ?? defaultPlaneSize)),
    visible: options.visible ?? true,
    color: options.color ?? pickDefaultGraphColor(options.index),
    appearance: {
      ...defaultPlaneAppearance,
      ...options.appearance
    }
  };
}
