import type {
  ImplicitSurfaceDomain,
  ImplicitSurfaceObject,
  ParametricCurveObject,
  ParametricSurfaceDomain,
  ParametricSurfaceObject,
  PlaneAppearance,
  PlaneGraphObject,
  SurfaceAppearance,
  SurfaceDomain,
  SurfaceGraphObject,
  VectorFieldDimension,
  VectorFieldDomain2D,
  VectorFieldDomain3D,
  VectorFieldObject,
  VectorFieldObject2D,
  VectorFieldObject3D
} from "./types";

export const defaultGraphPalette = ["#3b82f6", "#06b6d4", "#f59e0b", "#fb7185", "#22c55e"];

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

export const MIN_SURFACE_RESOLUTION = 2;
export const MAX_SURFACE_RESOLUTION = 128;
export const defaultSurfaceResolution = 80;
export const defaultSurfaceEquation = "sin(x) * cos(y)";

export function normalizeSurfaceResolution(value: number): number {
  const normalized = Math.floor(value);
  return Math.min(MAX_SURFACE_RESOLUTION, Math.max(MIN_SURFACE_RESOLUTION, normalized));
}

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

// Parametric surfaces sample a (resolution + 1) x (resolution + 1) grid, so
// one resolution serves both parameter directions (same convention as the
// explicit-surface grid). At the cap, 129 x 129 = 16641 vertices stay under
// the Uint16 index limit (65536) and ~200KB under the 2MB position budget.
export const MIN_PARAMETRIC_SURFACE_RESOLUTION = 2;
export const MAX_PARAMETRIC_SURFACE_RESOLUTION = 128;
export const defaultParametricSurfaceResolution = 48;

export function normalizeParametricSurfaceResolution(value: number): number {
  const normalized = Math.floor(value);
  return Math.min(MAX_PARAMETRIC_SURFACE_RESOLUTION, Math.max(MIN_PARAMETRIC_SURFACE_RESOLUTION, normalized));
}

export const defaultParametricSurfaceExpressions = {
  xExpr: "u",
  yExpr: "v",
  zExpr: "0"
};

export const defaultParametricSurfaceDomain: ParametricSurfaceDomain = {
  uMin: -5,
  uMax: 5,
  vMin: -5,
  vMax: 5
};

// Implicit surfaces sample a (resolution + 1)^3 scalar grid, so O(n^3)
// forces a much smaller cap than the O(n^2) surface grids. At the cap,
// 49^3 = 117649 samples stay browser-safe; the extraction budget and index
// type are decided after extraction (Uint16 vs Uint32).
export const MIN_IMPLICIT_SURFACE_RESOLUTION = 2;
export const MAX_IMPLICIT_SURFACE_RESOLUTION = 48;
export const defaultImplicitSurfaceResolution = 32;

export function normalizeImplicitSurfaceResolution(value: number): number {
  const normalized = Math.floor(value);
  return Math.min(MAX_IMPLICIT_SURFACE_RESOLUTION, Math.max(MIN_IMPLICIT_SURFACE_RESOLUTION, normalized));
}

export const defaultImplicitSurfaceEquation = "x^2 + y^2 + z^2 - 9";

export const defaultImplicitSurfaceDomain: ImplicitSurfaceDomain = {
  xMin: -5,
  xMax: 5,
  yMin: -5,
  yMax: 5,
  zMin: -5,
  zMax: 5
};

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

interface CreateDefaultParametricSurfaceOptions {
  id: string;
  index?: number;
  xExpr?: string;
  yExpr?: string;
  zExpr?: string;
  domain?: Partial<ParametricSurfaceDomain>;
  resolution?: number;
  visible?: boolean;
  color?: string;
  appearance?: Partial<SurfaceAppearance>;
}

interface CreateDefaultImplicitSurfaceOptions {
  id: string;
  index?: number;
  equation?: string;
  domain?: Partial<ImplicitSurfaceDomain>;
  resolution?: number;
  visible?: boolean;
  color?: string;
  appearance?: Partial<SurfaceAppearance>;
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
    resolution: normalizeSurfaceResolution(options.resolution ?? defaultSurfaceResolution),
    appearance: {
      ...defaultSurfaceAppearance,
      ...options.appearance
    },
    orientation: "z"
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

export function createDefaultParametricSurfaceGraph(
  options: CreateDefaultParametricSurfaceOptions
): ParametricSurfaceObject {
  const baseDomain = {
    ...defaultParametricSurfaceDomain,
    ...options.domain
  };

  return {
    id: options.id,
    kind: "parametricSurface",
    xExpr: options.xExpr ?? defaultParametricSurfaceExpressions.xExpr,
    yExpr: options.yExpr ?? defaultParametricSurfaceExpressions.yExpr,
    zExpr: options.zExpr ?? defaultParametricSurfaceExpressions.zExpr,
    visible: options.visible ?? true,
    color: options.color ?? pickDefaultGraphColor(options.index),
    domain: {
      uMin: baseDomain.uMin,
      uMax: baseDomain.uMax,
      vMin: baseDomain.vMin,
      vMax: baseDomain.vMax
    },
    resolution: normalizeParametricSurfaceResolution(options.resolution ?? defaultParametricSurfaceResolution),
    appearance: {
      ...defaultSurfaceAppearance,
      ...options.appearance
    }
  };
}

export function createDefaultImplicitSurfaceGraph(
  options: CreateDefaultImplicitSurfaceOptions
): ImplicitSurfaceObject {  const baseDomain = {
    ...defaultImplicitSurfaceDomain,
    ...options.domain
  };

  return {
    id: options.id,
    kind: "implicitSurface",
    equation: options.equation ?? defaultImplicitSurfaceEquation,
    visible: options.visible ?? true,
    color: options.color ?? pickDefaultGraphColor(options.index),
    domain: {
      xMin: baseDomain.xMin,
      xMax: baseDomain.xMax,
      yMin: baseDomain.yMin,
      yMax: baseDomain.yMax,
      zMin: baseDomain.zMin,
      zMax: baseDomain.zMax
    },
    resolution: normalizeImplicitSurfaceResolution(options.resolution ?? defaultImplicitSurfaceResolution),
    appearance: {
      ...defaultSurfaceAppearance,
      ...options.appearance
    }
  };
}

// Vector fields sample a density-per-axis grid: 2D density^2 glyphs,
// 3D density^3 glyphs. Caps keep worst cases browser-safe without a
// benchmark framework: 32^2 = 1024 2D arrows draw cheaply on Canvas2D,
// 12^3 = 1728 3D instances stay usable with the S16 scene drawn four
// times in Quad. Single density serves every axis (no xDensity/yDensity).
export const MIN_VECTOR_FIELD_DENSITY = 2;
export const MAX_VECTOR_FIELD_2D_DENSITY = 32;
export const MAX_VECTOR_FIELD_3D_DENSITY = 12;
export const defaultVectorField2DDensity = 16;
export const defaultVectorField3DDensity = 8;

export function maxVectorFieldDensityForDimension(dimension: VectorFieldDimension): number {
  return dimension === "2d" ? MAX_VECTOR_FIELD_2D_DENSITY : MAX_VECTOR_FIELD_3D_DENSITY;
}

// Worst-case glyph count: 12^3 = 1728 3D instances (2D caps at 32^2 =
// 1024). Reference for scene-pressure normalization (PART 23).
export const MAX_VECTOR_FIELD_GLYPH_COUNT = MAX_VECTOR_FIELD_3D_DENSITY ** 3;

// S24 streamline pressure reference: worst-case packed points per job
// (PART 8/34). Render-segment estimates normalize against the same bound
// packed points obey, keeping one conservative budget across compute and
// draw pressure.
export const MAX_STREAMLINE_SEGMENT_COUNT = 65536;

export function normalizeVectorFieldDensity(value: number, dimension: VectorFieldDimension): number {
  const normalized = Math.floor(value);
  return Math.min(
    maxVectorFieldDensityForDimension(dimension),
    Math.max(MIN_VECTOR_FIELD_DENSITY, normalized)
  );
}

// Glyph length policy anchor: scale multiplies the magnitude-normalized
// length (capped at one cell spacing). Zero would hide every glyph while
// the object stays "visible", so the floor is a small positive value.
export const MIN_VECTOR_FIELD_SCALE = 0.1;
export const MAX_VECTOR_FIELD_SCALE = 3;
export const defaultVectorFieldScale = 1;

export function normalizeVectorFieldScale(value: number): number {
  return Math.min(MAX_VECTOR_FIELD_SCALE, Math.max(MIN_VECTOR_FIELD_SCALE, value));
}

export const defaultVectorField2DComponents = {
  pExpr: "x",
  qExpr: "y"
};

export const defaultVectorField3DComponents = {
  pExpr: "x",
  qExpr: "y",
  rExpr: "z"
};

export const defaultVectorField2DDomain: VectorFieldDomain2D = {
  xMin: -5,
  xMax: 5,
  yMin: -5,
  yMax: 5
};

// 3D default is ±3 (not ±5): the default perspective camera sits at
// (6,6,6) looking corner-on through the domain, so a ±5 field stacks eight
// arrow layers along the view ray with near-corner glyphs looming across
// the viewport. ±3 clears the camera by ~6 cells so a fresh field reads
// correctly before the user orbits (2D auto-fits, so it keeps ±5).
export const defaultVectorField3DDomain: VectorFieldDomain3D = {
  xMin: -3,
  xMax: 3,
  yMin: -3,
  yMax: 3,
  zMin: -3,
  zMax: 3
};

interface CreateDefaultVectorFieldGraphOptions {
  id: string;
  dimension: VectorFieldDimension;
  index?: number;
  pExpr?: string;
  qExpr?: string;
  rExpr?: string;
  domain?: Partial<VectorFieldDomain2D & VectorFieldDomain3D>;
  density?: number;
  scale?: number;
  normalize?: boolean;
  visible?: boolean;
  color?: string;
}

export function createDefaultVectorFieldGraph(
  options: CreateDefaultVectorFieldGraphOptions & { dimension: "2d" }
): VectorFieldObject2D;
export function createDefaultVectorFieldGraph(
  options: CreateDefaultVectorFieldGraphOptions & { dimension: "3d" }
): VectorFieldObject3D;
export function createDefaultVectorFieldGraph(
  options: CreateDefaultVectorFieldGraphOptions
): VectorFieldObject;
export function createDefaultVectorFieldGraph(
  options: CreateDefaultVectorFieldGraphOptions
): VectorFieldObject {
  const dimension = options.dimension;
  const color = options.color ?? pickDefaultGraphColor(options.index);
  const visible = options.visible ?? true;

  if (dimension === "2d") {
    const baseDomain = { ...defaultVectorField2DDomain, ...options.domain };
    return {
      id: options.id,
      kind: "vectorField",
      dimension: "2d",
      pExpr: options.pExpr ?? defaultVectorField2DComponents.pExpr,
      qExpr: options.qExpr ?? defaultVectorField2DComponents.qExpr,
      rExpr: "",
      domain: {
        xMin: baseDomain.xMin,
        xMax: baseDomain.xMax,
        yMin: baseDomain.yMin,
        yMax: baseDomain.yMax
      },
      density: normalizeVectorFieldDensity(options.density ?? defaultVectorField2DDensity, dimension),
      scale: Number.isFinite(options.scale)
        ? normalizeVectorFieldScale(options.scale as number)
        : defaultVectorFieldScale,
      normalize: options.normalize ?? false,
      visible,
      color
    };
  }

  const baseDomain = { ...defaultVectorField3DDomain, ...options.domain };
  return {
    id: options.id,
    kind: "vectorField",
    dimension: "3d",
    pExpr: options.pExpr ?? defaultVectorField3DComponents.pExpr,
    qExpr: options.qExpr ?? defaultVectorField3DComponents.qExpr,
    rExpr: options.rExpr ?? defaultVectorField3DComponents.rExpr,
    domain: {
      xMin: baseDomain.xMin,
      xMax: baseDomain.xMax,
      yMin: baseDomain.yMin,
      yMax: baseDomain.yMax,
      zMin: baseDomain.zMin ?? defaultVectorField3DDomain.zMin,
      zMax: baseDomain.zMax ?? defaultVectorField3DDomain.zMax
    },
    density: normalizeVectorFieldDensity(options.density ?? defaultVectorField3DDensity, dimension),
    scale: Number.isFinite(options.scale)
      ? normalizeVectorFieldScale(options.scale as number)
      : defaultVectorFieldScale,
    normalize: options.normalize ?? false,
    visible,
    color
  };
}
