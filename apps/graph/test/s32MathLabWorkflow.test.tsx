// S32 Math Lab interaction & workflow refinement: expression-first Object
// tab, compact domain, subordinate sampling, draft preservation, contextual
// Analyze, math-precise selectors/labels, navigator snippets.
//
// ENGINE FREEZE: zero math/worker/persistence changes — these tests pin UI
// presentation and draft lifecycle only.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import InspectorPanel from "@/components/layout/InspectorPanel";
import ObjectInspector from "@/components/inspector/ObjectInspector";
import AnalysisInspector from "@/components/inspector/AnalysisInspector";
import IntegralAnalysisSection from "@/components/inspector/IntegralAnalysisSection";
import LinearTransformInspector from "@/components/inspector/LinearTransformInspector";
import VectorCalculusSection from "@/components/inspector/VectorCalculusSection";
import DifferentialAnalysisSection from "@/components/inspector/DifferentialAnalysisSection";
import { getObjectRowDisplayMeta } from "@/components/objects/objectRowUtils";
import { analysisSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { useGraphStore } from "@/store/graphStore";
import { createDefaultSurfaceGraph } from "@vinculum/scene/defaults";

function resetScene() {
  useGraphStore.getState().resetScene();
}

function addSurface(equation = "x^2 + y^2"): string {
  const state = useGraphStore.getState();
  const id = state.addSurfaceObject();
  state.updateSurfaceEquation(id, equation);
  state.selectObject(id);
  return id;
}

function liveObject(id: string) {
  const object = useGraphStore.getState().scene.objects.find((candidate) => candidate.id === id);
  if (!object) {
    throw new Error(`object ${id} missing`);
  }
  return object;
}

describe("S32 expression-first Object tab", () => {
  beforeEach(() => {
    resetScene();
  });

  it("surface Object tab leads with the equation, dependent variable, and compact domain", () => {
    const id = addSurface();
    render(<ObjectInspector />);
    // Definition is dominant and mathematically labelled.
    const expression = screen.getByLabelText("Surface expression z = f(x,y)");
    expect(expression).toBeDefined();
    expect((expression as HTMLInputElement).value).toBe("x^2 + y^2");
    // Dependent-variable control uses mathematical form, not enum names.
    const dependent = screen.getByLabelText("Dependent variable");
    expect((dependent as HTMLSelectElement).value).toBe("z");
    expect(within(dependent as HTMLElement).getByRole("option", { name: "z = f(x,y)" })).toBeDefined();
    // Compact paired domain, subordinate to the equation.
    expect(screen.getByLabelText("x min")).toBeDefined();
    expect(screen.getByLabelText("x max")).toBeDefined();
    expect(screen.getByLabelText("y min")).toBeDefined();
    expect(screen.getByLabelText("y max")).toBeDefined();
    // No duplicated resolution editor — Styles owns it.
    expect(screen.queryByLabelText("Resolution")).toBeNull();
    expect(screen.queryByText(/adjust in the Styles tab/)).toBeNull();
    void id;
  });

  it("orientation switch updates labels coherently with no stale field names", () => {
    const id = addSurface();
    render(<ObjectInspector />);
    fireEvent.change(screen.getByLabelText("Dependent variable"), { target: { value: "x" } });
    expect(screen.getByLabelText("Surface expression x = f(y,z)")).toBeDefined();
    expect(useGraphStore.getState().scene.objects.find((o) => o.id === id)).toMatchObject({
      orientation: "x"
    });
  });

  it("parametric curve groups r(t) tuple with t domain and subordinate sampling", () => {
    const state = useGraphStore.getState();
    const id = state.addParametricCurve();
    state.selectObject(id);
    render(<ObjectInspector />);
    const group = screen.getByRole("group", { name: "Parametric curve components r(t)" });
    expect(group).toBeDefined();
    const x = screen.getByLabelText("Parametric x(t)");
    const y = screen.getByLabelText("Parametric y(t)");
    const z = screen.getByLabelText("Parametric z(t)");
    // Tab order: x(t) → y(t) → z(t) → t min → t max.
    const order = [x, y, z, screen.getByLabelText("t min"), screen.getByLabelText("t max")];
    const positions = order.map((element) =>
      Array.from(document.querySelectorAll("input, select, button, summary")).indexOf(element)
    );
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // Sampling is progressively disclosed, not competing with the tuple.
    expect(screen.getByText(/Sampling ·/)).toBeDefined();
    void id;
  });

  it("parametric surface shows r(u,v) tuple with u/v domains and Styles-owned resolution", () => {
    const state = useGraphStore.getState();
    const id = state.addParametricSurface();
    state.selectObject(id);
    render(<ObjectInspector />);
    expect(screen.getByRole("group", { name: "Parametric surface components r(u,v)" })).toBeDefined();
    expect(screen.getByLabelText("Parametric surface x(u,v)")).toBeDefined();
    expect(screen.getByLabelText("u min")).toBeDefined();
    expect(screen.getByLabelText("v max")).toBeDefined();
    expect(screen.queryByLabelText("Resolution")).toBeNull();
    expect(screen.queryByText(/adjust in the Styles tab/)).toBeNull();
    void id;
  });

  it("implicit surface leads with F(x,y,z) = 0 and a compact sampling box", () => {
    const state = useGraphStore.getState();
    const id = state.addImplicitSurface();
    state.updateImplicitSurfaceExpression(id, "equation", "x^2 + y^2 + z^2 = 1");
    state.selectObject(id);
    render(<ObjectInspector />);
    const equation = screen.getByLabelText("Implicit surface equation F(x,y,z) = 0");
    expect((equation as HTMLInputElement).value).toBe("x^2 + y^2 + z^2 = 1");
    expect(screen.getByLabelText("z min")).toBeDefined();
    expect(screen.getByLabelText("z max")).toBeDefined();
    void id;
  });

  it("vector field groups components as one vector with separate domain and subordinate density", () => {
    const state = useGraphStore.getState();
    const id = state.addVectorFieldObject("2d");
    state.selectObject(id);
    render(<ObjectInspector />);
    expect(screen.getByRole("group", { name: "Vector field components F(x,y)" })).toBeDefined();
    expect(screen.getByLabelText("Vector field P component")).toBeDefined();
    expect(screen.getByLabelText("Vector field Q component")).toBeDefined();
    // 2D shows no R component.
    expect(screen.queryByLabelText("Vector field R component")).toBeNull();
    // Dimension control is obvious but subordinate to the definition.
    expect(screen.getByLabelText("Vector field dimension")).toBeDefined();
    // Density is progressively disclosed.
    expect(screen.getByText(/Sampling · density/)).toBeDefined();
    void id;
  });

  it("3D vector field shows the R component", () => {
    const state = useGraphStore.getState();
    const id = state.addVectorFieldObject("3d");
    state.selectObject(id);
    render(<ObjectInspector />);
    expect(screen.getByRole("group", { name: "Vector field components F(x,y,z)" })).toBeDefined();
    expect(screen.getByLabelText("Vector field R component")).toBeDefined();
    expect(screen.getByLabelText("z min")).toBeDefined();
    void id;
  });
});

describe("S32 draft preservation and error-tolerant typing", () => {
  beforeEach(() => {
    resetScene();
  });

  it("invalid intermediate typing commits to canonical state and survives Object→Analyze→Object", () => {
    addSurface("x^2");
    render(<InspectorPanel mode="object" activeToolLabel="Pan" />);
    const expression = screen.getByLabelText("Surface expression z = f(x,y)") as HTMLInputElement;
    fireEvent.focus(expression);
    // Transient invalid intermediate: canonical commit keeps it editable.
    fireEvent.change(expression, { target: { value: "sin(" } });
    expect(useGraphStore.getState().scene.objects[0]).toMatchObject({ equation: "sin(" });
    expect((screen.getByLabelText("Surface expression z = f(x,y)") as HTMLInputElement).value).toBe("sin(");

    fireEvent.click(screen.getByRole("tab", { name: "Analyze" }));
    fireEvent.click(screen.getByRole("tab", { name: "Edit" }));
    // Valid draft preserved across tab switches.
    expect((screen.getByLabelText("Surface expression z = f(x,y)") as HTMLInputElement).value).toBe("sin(");
  });

  it("focused expression draft is not clobbered by unrelated canonical updates", () => {
    const id = addSurface("x^2");
    render(<ObjectInspector />);
    const expression = screen.getByLabelText("Surface expression z = f(x,y)") as HTMLInputElement;
    fireEvent.focus(expression);
    fireEvent.change(expression, { target: { value: "x^3" } });
    // Unrelated canonical update (domain) while typing keeps the draft/caret context.
    useGraphStore.getState().updateSurfaceDomain(id, { xMin: -4 });
    expect((screen.getByLabelText("Surface expression z = f(x,y)") as HTMLInputElement).value).toBe("x^3");
  });

  it("Analyze integrand draft commits (never silently destroyed) across tab switches", () => {
    const state = useGraphStore.getState();
    const curveId = state.addParametricCurve();
    state.selectObject(curveId);
    render(<InspectorPanel mode="object" activeToolLabel="Pan" />);
    fireEvent.click(screen.getByRole("tab", { name: "Analyze" }));
    // Integral integrand draft (local until Enter/blur) survives a roundtrip.
    fireEvent.change(screen.getByLabelText("Integral mode"), { target: { value: "scalarLine" } });
    const integrand = screen.getByLabelText("Scalar integrand g(x,y,z)") as HTMLInputElement;
    fireEvent.change(integrand, { target: { value: "x + y" } });
    fireEvent.click(screen.getByRole("tab", { name: "Edit" }));
    fireEvent.click(screen.getByRole("tab", { name: "Analyze" }));
    expect((screen.getByLabelText("Scalar integrand g(x,y,z)") as HTMLInputElement).value).toBe("x + y");
  });
});

describe("S32 Analyze refinement", () => {
  beforeEach(() => {
    resetScene();
  });

  it("differential section distinguishes function gradient from level-set normal", () => {
    const id = addSurface();
    const object = liveObject(id);
    if (object.kind !== "surface") {
      throw new Error("expected surface");
    }
    const identity = analysisSourceIdentity(object);
    if (!identity) {
      throw new Error("expected identity");
    }
    useGraphStore.getState().setDifferentialAnalysisPoint(id, { x: 1, y: 1, z: 2 }, identity);
    const { unmount } = render(<DifferentialAnalysisSection object={liveObject(id) as typeof object} />);
    expect(screen.getByText(/Surface normal =/)).toBeDefined();
    unmount();

    const store = useGraphStore.getState();
    const implicitId = store.addImplicitSurface();
    store.updateImplicitSurfaceExpression(implicitId, "equation", "x^2 + y^2 + z^2 - 1");
    const implicit = liveObject(implicitId);
    if (implicit.kind !== "implicitSurface") {
      throw new Error("expected implicit surface");
    }
    const implicitIdentity = analysisSourceIdentity(implicit);
    if (!implicitIdentity) {
      throw new Error("expected identity");
    }
    store.setDifferentialAnalysisPoint(implicitId, { x: 1, y: 0, z: 0 }, implicitIdentity);
    render(<DifferentialAnalysisSection object={liveObject(implicitId) as typeof implicit} />);
    expect(screen.getByText(/Level-set normal =/)).toBeDefined();
  });

  it("vector calculus empty state instructs instead of blank Jacobian dashes", () => {
    const state = useGraphStore.getState();
    const id = state.addVectorFieldObject("2d");
    state.selectObject(id);
    const object = liveObject(id);
    if (object.kind !== "vectorField") {
      throw new Error("expected vector field");
    }
    render(<VectorCalculusSection object={object} />);
    expect(screen.getByText(/Enter a point in the field domain/)).toBeDefined();
    expect(screen.queryByTestId("vector-calculus-jacobian")).toBeNull();
  });

  it("integral field selector shows canonical labels and typesets the selected field", () => {
    const state = useGraphStore.getState();
    const curveId = state.addParametricCurve();
    const fieldId = state.addVectorFieldObject("3d");
    state.updateVectorFieldExpression(fieldId, "pExpr", "x");
    state.updateVectorFieldExpression(fieldId, "qExpr", "y");
    state.updateVectorFieldExpression(fieldId, "rExpr", "z");
    state.selectObject(curveId);
    const curve = liveObject(curveId);
    if (curve.kind !== "parametricCurve") {
      throw new Error("expected curve");
    }
    render(<IntegralAnalysisSection object={curve} />);
    fireEvent.change(screen.getByLabelText("Integral mode"), { target: { value: "work" } });
    const select = screen.getByLabelText("Vector field") as HTMLSelectElement;
    const labels = Array.from(select.options).map((option) => option.label);
    expect(labels.some((label) => label.includes("3D Vector Field #"))).toBe(true);
    expect(labels.some((label) => label.includes("<"))).toBe(false);
    fireEvent.change(select, { target: { value: fieldId } });
    expect(screen.getByRole("math", { name: "<x, y, z>" })).toBeDefined();
    expect(labels.some((label) => /[0-9a-f-]{8,}/.test(label) && !label.includes("#"))).toBe(false);
  });

  it("surface flux orientation uses mathematical +axis/−axis wording", () => {
    const id = addSurface();
    const object = liveObject(id);
    if (object.kind !== "surface") {
      throw new Error("expected surface");
    }
    render(<IntegralAnalysisSection object={object} />);
    fireEvent.change(screen.getByLabelText("Integral mode"), { target: { value: "flux" } });
    const orientation = screen.getByLabelText("Surface orientation") as HTMLSelectElement;
    const labels = Array.from(orientation.options).map((option) => option.label);
    expect(labels.some((label) => label.includes("+z"))).toBe(true);
    expect(labels.some((label) => label.includes("−z"))).toBe(true);
  });

  it("linear Apply-to-Vector selector shows canonical labels and typesets the selected vector", () => {
    const state = useGraphStore.getState();
    const transformId = state.addLinearTransformObject("2d");
    const vectorId = state.addVectorObject();
    state.selectObject(transformId);
    const transform = liveObject(transformId);
    if (transform.kind !== "linearTransform") {
      throw new Error("expected transform");
    }
    render(<LinearTransformInspector object={transform} section="analysis" />);
    const select = screen.getByLabelText("Vector for transformation analysis") as HTMLSelectElement;
    const labels = Array.from(select.options).map((option) => option.label);
    expect(labels.some((label) => label.startsWith("Vector #"))).toBe(true);
    expect(labels.some((label) => label.includes("<"))).toBe(false);
    fireEvent.change(select, { target: { value: vectorId } });
    const vector = liveObject(vectorId);
    if (vector.kind !== "vector") throw new Error("expected vector");
    expect(within(select.closest("label")!).getByRole("math", { name: `<${vector.vxExpr}, ${vector.vyExpr}, ${vector.vzExpr}>` })).toBeDefined();
  });

  it("Analyze shows contextual sections per kind and hides irrelevant ones", () => {
    const state = useGraphStore.getState();
    const fieldId = state.addVectorFieldObject("2d");
    state.selectObject(fieldId);
    render(<AnalysisInspector />);
    // Vector field: Vector Calculus + Streamlines, no Integral Analysis.
    expect(screen.getByTestId("vector-calculus-section")).toBeDefined();
    expect(screen.getByTestId("streamline-section")).toBeDefined();
    expect(screen.queryByTestId("integral-analysis-section")).toBeNull();
  });
});

describe("S32 navigator math snippets", () => {
  it("collapsed rows prioritize mathematical definitions", () => {
    expect(
      getObjectRowDisplayMeta(createDefaultSurfaceGraph({ id: "s1", equation: "x^2 + y^2" })).type
    ).toBe("z = x^2 + y^2");
    const implicit = getObjectRowDisplayMeta({
      ...createDefaultSurfaceGraph({ id: "s2", equation: "x^2 + y^2 + z^2 = 1" }),
      kind: "implicitSurface",
      domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 },
      resolution: 16
    } as never);
    expect(implicit.type).toBe("x^2 + y^2 + z^2 = 1");
  });

  it("workspace and view switches preserve selection without touching the scene", () => {
    resetScene();
    const id = useGraphStore.getState().addSurfaceObject();
    useGraphStore.getState().selectObject(id);
    const before = JSON.stringify(useGraphStore.getState().scene.objects);
    useGraphStore.getState().setWorkspace("geometry");
    useGraphStore.getState().setWorkspace("math");
    useGraphStore.getState().setGraphMode("2d");
    useGraphStore.getState().setGraphMode("3d");
    const after = useGraphStore.getState();
    expect(after.ui.selectedObjectId).toBe(id);
    expect(JSON.stringify(after.scene.objects)).toBe(before);
  });

  it("UI-only workflow leaves the serialized scene identical (PART 60)", () => {
    resetScene();
    const store = useGraphStore.getState();
    const surfaceId = store.addSurfaceObject();
    store.updateSurfaceEquation(surfaceId, "x^2 + y^2");
    const fieldId = store.addVectorFieldObject("2d");
    store.updateVectorFieldExpression(fieldId, "pExpr", "-y");
    store.updateVectorFieldExpression(fieldId, "qExpr", "x");
    const before = JSON.stringify(useGraphStore.getState().scene);
    // Pure UI navigation: selection, workspace, view mode, analysis toggles.
    useGraphStore.getState().selectObject(fieldId);
    useGraphStore.getState().selectObject(surfaceId);
    useGraphStore.getState().setWorkspace("geometry");
    useGraphStore.getState().setWorkspace("math");
    useGraphStore.getState().setGraphMode("2d");
    useGraphStore.getState().setGraphMode("3d");
    useGraphStore.getState().setStreamlineConfig(
      fieldId,
      { enabled: true },
      "test-structure"
    );
    useGraphStore.getState().clearStreamline(fieldId);
    expect(JSON.stringify(useGraphStore.getState().scene)).toBe(before);
  });
});

describe("surface plot range follows the output axis", () => {
  beforeEach(resetScene);

  it.each([
    ["x", "y", "z"],
    ["y", "x", "z"],
    ["z", "x", "y"]
  ] as const)("labels the independent axes for %s = f(%s,%s) and preserves domain ownership", (output, first, second) => {
    const id = addSurface("1");
    useGraphStore.getState().updateSurfaceOrientation(id, output);
    render(<ObjectInspector />);
    expect(screen.getByLabelText(`${first} min`)).toBeVisible();
    expect(screen.getByLabelText(`${second} max`)).toBeVisible();
    expect(screen.queryByLabelText(`${output} min`)).toBeNull();
    fireEvent.change(screen.getByLabelText(`${first} min`), { target: { value: "-3" } });
    expect(liveObject(id)).toMatchObject({ domain: { xMin: -3 } });
    fireEvent.change(screen.getByLabelText(`${second} max`), { target: { value: "7" } });
    expect(liveObject(id)).toMatchObject({ domain: { yMax: 7 } });
    expect(screen.getByText("How to type math")).toBeVisible();
  });
});
