export type GraphObjectKind =
  | "surface"
  | "implicitCurve"
  | "parametricCurve"
  | "plane"
  | "parametricSurface"
  | "implicitSurface"
  | "vectorField"
  | "point"
  | "vector"
  | "line"
  | "ray"
  | "segment"
  | "linearTransform";

export interface GraphObjectBase {
  id: string;
  kind: GraphObjectKind;
  color: string;
  visible: boolean;
  /** Equation-first authoring: edits infer the graph kind automatically. */
  autoExpression?: boolean;
}

export interface ImplicitCurveObject extends GraphObjectBase {
  kind: "implicitCurve";
  equation: string;
  /** Opt-in extrusion along z; the equation remains a 2D curve. */
  extendTo3D?: boolean;
}

export interface SurfaceDomain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface SurfaceAppearance {
  wireframe: boolean;
}

export type SurfaceOrientation = "z" | "y" | "x";

export interface SurfaceGraphObject extends GraphObjectBase {
  kind: "surface";
  equation: string;
  domain: SurfaceDomain;
  resolution: number;
  appearance: SurfaceAppearance;
  orientation?: SurfaceOrientation;
  /** Render a camera-sized region instead of the saved custom range. */
  autoDomain?: boolean;
}

export interface ParametricCurveObject extends GraphObjectBase {
  kind: "parametricCurve";
  xExpr: string;
  yExpr: string;
  zExpr: string;
  tMin: number;
  tMax: number;
  samples: number;
}

export interface ParametricSurfaceDomain {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

export interface ParametricSurfaceObject extends GraphObjectBase {
  kind: "parametricSurface";
  xExpr: string;
  yExpr: string;
  zExpr: string;
  domain: ParametricSurfaceDomain;
  resolution: number;
  appearance: SurfaceAppearance;
}

export interface ImplicitSurfaceDomain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

export interface ImplicitSurfaceObject extends GraphObjectBase {
  kind: "implicitSurface";
  equation: string;
  domain: ImplicitSurfaceDomain;
  resolution: number;
  appearance: SurfaceAppearance;
}

export interface PlaneAppearance {
  wireframe: boolean;
}

export interface PlaneGraphObject extends GraphObjectBase {
  kind: "plane";
  equation: string;
  size: number;
  appearance: PlaneAppearance;
}

// S20: one canonical vector-field concept. Dimension defaults at creation
// but converts explicitly via the type selectors (2D Vector Field / 3D
// Vector Field); conversion resets components to the new dimension's
// defaults, like other kind conversions. Components use P/Q/R
// terminology. scale/normalize are top-level render-only fields (like
// color): they affect glyph sizing only and are excluded from structure
// identity, so changing them never resamples. density/domain/components
// are sampling identity. Scene stores expressions/settings only — sampled
// arrows are transient computed data, never scene objects.
export type VectorFieldDimension = "2d" | "3d";

export interface VectorFieldDomain2D {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface VectorFieldDomain3D {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

export interface VectorFieldBase extends GraphObjectBase {
  kind: "vectorField";
  dimension: VectorFieldDimension;
  pExpr: string;
  qExpr: string;
  rExpr: string;
  density: number;
  scale: number;
  normalize: boolean;
}

export interface VectorFieldObject2D extends VectorFieldBase {
  dimension: "2d";
  domain: VectorFieldDomain2D;
}

export interface VectorFieldObject3D extends VectorFieldBase {
  dimension: "3d";
  domain: VectorFieldDomain3D;
}

export type VectorFieldObject = VectorFieldObject2D | VectorFieldObject3D;

// S26: canonical geometric primitives. Coordinates are scalar-expression
// strings over constants/pi/e/scene-parameters (same convention as curve
// xExpr and field P/Q/R); the single shared coordinate compiler resolves
// them, so raw text roundtrips byte-exact through persistence. Appearance
// stays minimal (base color/visible); there is no wireframe or dash
// policy in S26.
//
// Naming (S20 collision warning): `vector` is ONE geometric vector
// (components + visual anchor origin). `vectorField` is unchanged: a
// function assigning a vector at every point.
export interface VectorObject extends GraphObjectBase {
  kind: "vector";
  oxExpr: string;
  oyExpr: string;
  ozExpr: string;
  vxExpr: string;
  vyExpr: string;
  vzExpr: string;
}

export interface LineObject extends GraphObjectBase {
  kind: "line";
  pxExpr: string;
  pyExpr: string;
  pzExpr: string;
  dxExpr: string;
  dyExpr: string;
  dzExpr: string;
}

export interface RayObject extends GraphObjectBase {
  kind: "ray";
  oxExpr: string;
  oyExpr: string;
  ozExpr: string;
  dxExpr: string;
  dyExpr: string;
  dzExpr: string;
}

export interface SegmentObject extends GraphObjectBase {
  kind: "segment";
  axExpr: string;
  ayExpr: string;
  azExpr: string;
  bxExpr: string;
  byExpr: string;
  bzExpr: string;
}

// S27: canonical geometric point. Coordinates are scalar-expression
// strings over constants/pi/e/scene-parameters (same convention as S26
// primitive fields); the single shared coordinate compiler resolves them,
// so raw text roundtrips byte-exact through persistence. Appearance stays
// minimal (base color/visible). This replaces the historical all-zero
// parametricCurve "Point" preset for NEW points; legacy scenes keep their
// constant curves untouched (no migration).
export interface PointObject extends GraphObjectBase {
  kind: "point";
  xExpr: string;
  yExpr: string;
  zExpr: string;
}

// S28: one canonical linear-transformation concept with a dimension, not
// two kinds. Matrix entries are flat scalar-expression strings (same
// S26/S27 coordinate convention: constants/pi/e/scene-parameters, no
// spatial locals); the single shared coordinate compiler resolves them,
// so raw text roundtrips byte-exact. 2D entries are m11,m12,m21,m22;
// 3D adds the third row/column (m13..m33). Row-major presentation and
// storage everywhere.
export type LinearTransformDimension = "2d" | "3d";

export interface LinearTransformBase extends GraphObjectBase {
  kind: "linearTransform";
  dimension: LinearTransformDimension;
}

export interface LinearTransformObject2D extends LinearTransformBase {
  dimension: "2d";
  m11: string;
  m12: string;
  m21: string;
  m22: string;
}

export interface LinearTransformObject3D extends LinearTransformBase {
  dimension: "3d";
  m11: string;
  m12: string;
  m13: string;
  m21: string;
  m22: string;
  m23: string;
  m31: string;
  m32: string;
  m33: string;
}

export type LinearTransformObject = LinearTransformObject2D | LinearTransformObject3D;

export type GraphObject =
  | SurfaceGraphObject
  | ImplicitCurveObject
  | ParametricCurveObject
  | PlaneGraphObject
  | ParametricSurfaceObject
  | ImplicitSurfaceObject
  | VectorFieldObject
  | PointObject
  | VectorObject
  | LineObject
  | RayObject
  | SegmentObject
  | LinearTransformObject;
