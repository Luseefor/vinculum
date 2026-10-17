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
import type { ObjectCreationKey } from "./objectDescriptors";

/** Reveal an object through the existing workspace/view controls. Scene data stays intact. */
export function revealObjectInViewport(id: string): void {
  const store = useGraphStore.getState();
  const object = store.scene.objects.find(entry => entry.id === id);
  if (!object) return;
  if ("equation" in object && !object.equation.trim()) return;
  const editor = useEditorStore.getState();
  const planar = (object.kind === "implicitCurve" && !object.extendTo3D) ||
    ((object.kind === "parametricCurve" || object.kind === "parametricSurface") && object.dimension === "2d") ||
    ((object.kind === "vectorField" || object.kind === "linearTransform") && object.dimension === "2d");
  if (planar) {
    store.setWorkspace("math");
    store.setActive2dViewport("primary");
    store.setAxis2DPair("xy");
  } else if (store.ui.workspace === "geometry") {
    return;
  }
  const mode = planar ? "2d" : "3d";
  store.setGraphMode(mode);
  if (editor.viewportMode !== "split" && editor.viewportMode !== "quad") {
    editor.setViewportMode(mode);
  }
}

export function createAndFocus(create: () => string): string {
  const id = create();
  if (id) {
    revealObjectInViewport(id);
    useGraphStore.getState().requestEquationFocus(id);
  }
  return id;
}

function notify(message: string): void {
  useEditorStore.getState().addConsoleEvent(message);
}

// Adding a catalog key requires a matching canonical store action here.
const objectCreators = {
  surface: () => useGraphStore.getState().addSurfaceObject(),
  "parametricCurve-2d": () => useGraphStore.getState().addParametricCurve("2d"),
  "parametricSurface-2d": () => useGraphStore.getState().addParametricSurface("2d"),
  parametricCurve: () => useGraphStore.getState().addParametricCurve(),
  parametricSurface: () => useGraphStore.getState().addParametricSurface(),
  implicitSurface: () => useGraphStore.getState().addImplicitSurface(),
  "vectorField-2d": () => useGraphStore.getState().addVectorFieldObject("2d"),
  "vectorField-3d": () => useGraphStore.getState().addVectorFieldObject("3d"),
  plane: () => useGraphStore.getState().addPlaneObject(),
  point: () => useGraphStore.getState().addPointObject(),
  vector: () => useGraphStore.getState().addVectorObject(),
  line: () => useGraphStore.getState().addLineObject(),
  ray: () => useGraphStore.getState().addRayObject(),
  segment: () => useGraphStore.getState().addSegmentObject(),
  "linearTransform-2d": () => useGraphStore.getState().addLinearTransformObject("2d"),
  "linearTransform-3d": () => useGraphStore.getState().addLinearTransformObject("3d")
} satisfies Record<ObjectCreationKey, () => string>;

/** Unknown external keys stay inert; every catalog entry has a typed creator. */
export function createObjectByKey(key: string): string {
  if (!Object.hasOwn(objectCreators, key)) return "";
  return createAndFocus(objectCreators[key as ObjectCreationKey]);
}

function createSurfaceTemplate(
  equation: string,
  message: string,
  domain?: { xMin: number; xMax: number; yMin: number; yMax: number }
): string {
  const store = useGraphStore.getState();
  const id = createAndFocus(() => store.addSurfaceObject());
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
  const id = createAndFocus(() => store.addParametricSurface());
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
  const id = createAndFocus(() => store.addImplicitSurface());
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
  const id = createAndFocus(() => store.addPlaneObject());
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
  const id = createAndFocus(() => store.addParametricCurve());
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
