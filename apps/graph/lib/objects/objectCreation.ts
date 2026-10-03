// S30 central object-creation behaviors (UI layer only).
//
// Every creation surface (Quick Add, Add Object menu, Command Palette via
// graphStore runCommand, context menus) funnels kind creation through
// `createObjectByKey` and preset creation through the preset builders below,
// so preset equations/domains cannot drift between surfaces.
//
// Reads stores via getState (established pattern for non-component callers);
// creates canonical objects through the existing graphStore actions only.
// No new scene semantics, no math changes.

import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";

export function createAndFocus(create: () => string): string {
  const id = create();
  if (id) {
    useGraphStore.getState().requestEquationFocus(id);
  }
  return id;
}

function notify(message: string): void {
  useEditorStore.getState().addConsoleEvent(message);
}

/** Create one canonical object by descriptor key (14 kind entries). */
export function createObjectByKey(key: string): string {
  const store = useGraphStore.getState();
  switch (key) {
    case "surface":
      return createAndFocus(() => store.addSurfaceObject());
    case "parametricCurve":
      return createAndFocus(() => store.addParametricCurve());
    case "parametricSurface":
      return createAndFocus(() => store.addParametricSurface());
    case "implicitSurface":
      return createAndFocus(() => store.addImplicitSurface());
    case "vectorField-2d":
      return createAndFocus(() => store.addVectorFieldObject("2d"));
    case "vectorField-3d":
      return createAndFocus(() => store.addVectorFieldObject("3d"));
    case "plane":
      return createAndFocus(() => store.addPlaneObject());
    case "point":
      // S27: Quick Add Point creates the real canonical point kind.
      return createAndFocus(() => store.addPointObject());
    case "vector":
      return createAndFocus(() => store.addVectorObject());
    case "line":
      return createAndFocus(() => store.addLineObject());
    case "ray":
      return createAndFocus(() => store.addRayObject());
    case "segment":
      return createAndFocus(() => store.addSegmentObject());
    case "linearTransform-2d":
      return createAndFocus(() => store.addLinearTransformObject("2d"));
    case "linearTransform-3d":
      return createAndFocus(() => store.addLinearTransformObject("3d"));
    default:
      return "";
  }
}

function createSurfaceTemplate(
  equation: string,
  message: string,
  domain?: { xMin: number; xMax: number; yMin: number; yMax: number }
): string {
  const store = useGraphStore.getState();
  const id = store.addSurfaceObject();
  store.updateSurfaceEquation(id, equation);
  if (domain) {
    store.updateSurfaceDomain(id, domain);
  }
  store.requestEquationFocus(id);
  notify(message);
  return id;
}

function createParametricSurfaceTemplate(
  expressions: { xExpr: string; yExpr: string; zExpr: string },
  domain: { uMin: number; uMax: number; vMin: number; vMax: number },
  message: string
): string {
  const store = useGraphStore.getState();
  const id = store.addParametricSurface();
  store.updateParametricSurfaceExpression(id, "xExpr", expressions.xExpr);
  store.updateParametricSurfaceExpression(id, "yExpr", expressions.yExpr);
  store.updateParametricSurfaceExpression(id, "zExpr", expressions.zExpr);
  store.updateParametricSurfaceExpression(id, "uMin", domain.uMin);
  store.updateParametricSurfaceExpression(id, "uMax", domain.uMax);
  store.updateParametricSurfaceExpression(id, "vMin", domain.vMin);
  store.updateParametricSurfaceExpression(id, "vMax", domain.vMax);
  store.requestEquationFocus(id);
  notify(message);
  return id;
}

function createImplicitSurfaceTemplate(
  equation: string,
  domain: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number },
  message: string
): string {
  const store = useGraphStore.getState();
  const id = store.addImplicitSurface();
  store.updateImplicitSurfaceExpression(id, "equation", equation);
  store.updateImplicitSurfaceExpression(id, "xMin", domain.xMin);
  store.updateImplicitSurfaceExpression(id, "xMax", domain.xMax);
  store.updateImplicitSurfaceExpression(id, "yMin", domain.yMin);
  store.updateImplicitSurfaceExpression(id, "yMax", domain.yMax);
  store.updateImplicitSurfaceExpression(id, "zMin", domain.zMin);
  store.updateImplicitSurfaceExpression(id, "zMax", domain.zMax);
  store.requestEquationFocus(id);
  notify(message);
  return id;
}

export function createSpherePreset(message = "Created sphere surface preset"): string {
  return createSurfaceTemplate("sqrt(max(0, 9 - x^2 - y^2))", message, {
    xMin: -3,
    xMax: 3,
    yMin: -3,
    yMax: 3
  });
}

export function createCylinderPreset(message = "Created cylinder surface preset"): string {
  return createSurfaceTemplate("sqrt(max(0, 4 - x^2))", message, {
    xMin: -2,
    xMax: 2,
    yMin: -6,
    yMax: 6
  });
}

export function createSphereCapPreset(): string {
  return createSpherePreset("Created sphere cap surface template");
}

export function createCylinderShellPreset(): string {
  return createCylinderPreset("Created cylinder shell surface template");
}

export function createBoxPlateauPreset(): string {
  return createSurfaceTemplate("1", "Created box plateau surface template", {
    xMin: -1,
    xMax: 1,
    yMin: -1,
    yMax: 1
  });
}

export function createParametricSpherePreset(message = "Created parametric sphere preset"): string {
  return createParametricSurfaceTemplate(
    { xExpr: "sin(u) * cos(v)", yExpr: "sin(u) * sin(v)", zExpr: "cos(u)" },
    { uMin: 0, uMax: 3.1415926536, vMin: 0, vMax: 6.2831853072 },
    message
  );
}

export function createParametricTorusPreset(message = "Created parametric torus preset"): string {
  return createParametricSurfaceTemplate(
    {
      xExpr: "(2 + 0.5 * cos(v)) * cos(u)",
      yExpr: "(2 + 0.5 * cos(v)) * sin(u)",
      zExpr: "0.5 * sin(v)"
    },
    { uMin: 0, uMax: 6.2831853072, vMin: 0, vMax: 6.2831853072 },
    message
  );
}

export function createImplicitSpherePreset(message = "Created implicit sphere preset"): string {
  return createImplicitSurfaceTemplate(
    "x^2 + y^2 + z^2 = 1",
    { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 },
    message
  );
}

export function createImplicitTorusPreset(): string {
  return createImplicitSurfaceTemplate(
    "(x^2 + y^2 + z^2 + 3.75)^2 - 16 * (x^2 + y^2) = 0",
    { xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -1, zMax: 1 },
    "Created implicit torus template"
  );
}

export function createSlicePlanePreset(): string {
  const store = useGraphStore.getState();
  const id = store.addPlaneObject();
  store.updatePlaneEquation(id, "z = 0");
  store.requestEquationFocus(id);
  notify("Created slice plane at z=0");
  return id;
}

/** Project the selected parametric curve onto z=0; null when inapplicable. */
export function createProjectionPreset(): string | null {
  const store = useGraphStore.getState();
  const selected = store.scene.objects.find((object) => object.id === store.ui.selectedObjectId) ?? null;
  if (!selected || selected.kind !== "parametricCurve") {
    notify("Projection requires a selected parametric curve");
    return null;
  }
  const id = store.addParametricCurve();
  store.updateParametricExpression(id, "xExpr", selected.xExpr);
  store.updateParametricExpression(id, "yExpr", selected.yExpr);
  store.updateParametricExpression(id, "zExpr", "0");
  store.updateParametricExpression(id, "tMin", selected.tMin);
  store.updateParametricExpression(id, "tMax", selected.tMax);
  store.updateParametricExpression(id, "samples", selected.samples);
  store.requestEquationFocus(id);
  notify("Projected selected parametric curve onto z=0");
  return id;
}
