export type GraphObjectKind = "surface" | "parametricCurve" | "plane" | "parametricSurface" | "implicitSurface";

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

export type GraphObject = SurfaceGraphObject | ParametricCurveObject | PlaneGraphObject | ParametricSurfaceObject | ImplicitSurfaceObject;
