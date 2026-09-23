export type GraphObjectKind = "surface" | "parametricCurve" | "plane" | "parametricSurface" | "implicitSurface" | "vectorField";

export interface GraphObjectBase {
  id: string;
  kind: GraphObjectKind;
  color: string;
  visible: boolean;
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

export type GraphObject = SurfaceGraphObject | ParametricCurveObject | PlaneGraphObject | ParametricSurfaceObject | ImplicitSurfaceObject | VectorFieldObject;
