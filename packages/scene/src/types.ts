export type GraphObjectKind = "surface" | "parametricCurve" | "plane";

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

export interface SurfaceGraphObject extends GraphObjectBase {
  kind: "surface";
  equation: string;
  domain: SurfaceDomain;
  resolution: number;
  appearance: SurfaceAppearance;
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

export interface PlaneAppearance {
  wireframe: boolean;
}

export interface PlaneGraphObject extends GraphObjectBase {
  kind: "plane";
  equation: string;
  size: number;
  appearance: PlaneAppearance;
}

export type GraphObject = SurfaceGraphObject | ParametricCurveObject | PlaneGraphObject;
