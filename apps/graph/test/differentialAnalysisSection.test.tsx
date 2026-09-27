import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ImplicitSurfaceObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { computeSurfaceAnalysis } from "@/lib/math/surfaceDifferential";
import {
  isAnalysisSourceCompilable,
  resolveAnalysisSectionModel
} from "@/components/inspector/differentialAnalysisSectionModel";
import { analysisSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import DifferentialAnalysisSection from "@/components/inspector/DifferentialAnalysisSection";

function makeSurface(equation: string, orientation?: "x" | "y" | "z"): SurfaceGraphObject {
  return {
    id: "s-1",
    kind: "surface",
    color: "#3b82f6",
    visible: true,
    equation,
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    resolution: 80,
    appearance: { wireframe: false },
    orientation
  };
}

function addSurface(equation = "z = x^2 + 2*y^2"): string {
  const store = useGraphStore.getState();
  const id = store.addSurfaceObject();
  store.updateSurfaceEquation(id, equation);
  return id;
}

function liveObject(id: string): SurfaceGraphObject {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object || object.kind !== "surface") {
    throw new Error("surface missing");
  }
  return object;
}

function identityOf(object: SurfaceGraphObject | ImplicitSurfaceObject): string {
  const identity = analysisSourceIdentity(object);
  if (identity === null) {
    throw new Error("expected analysis identity");
  }
  return identity;
}

describe("computeSurfaceAnalysis outcomes (S21 Slice 4)", () => {
  it("reports ok with gradient and plane for a valid explicit point", () => {
    const outcome = computeSurfaceAnalysis(makeSurface("z = x^2 + 2*y^2"), { x: 1, y: 2, z: 9 }, {});
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.gradient.x).toBeCloseTo(-2, 12);
    expect(outcome.unitNormal.z).toBeGreaterThan(0);
    expect(outcome.gValue).toBeCloseTo(0, 12);
  });

  it("reports invalid-source without touching derivative machinery", () => {
    expect(
      computeSurfaceAnalysis(makeSurface("zzz"), { x: 1, y: 2, z: 9 }, {}).status
    ).toBe("invalid-source");
  });

  it("reports derivative-unavailable for tan surfaces", () => {
    const outcome = computeSurfaceAnalysis(makeSurface("z = tan(x)"), { x: 0.5, y: 0, z: 0 }, {});
    expect(outcome.status).toBe("derivative-unavailable");
  });

  it("reports non-finite for singular partials at the point", () => {
    const outcome = computeSurfaceAnalysis(makeSurface("z = 1/x"), { x: 0, y: 1, z: 0 }, {});
    expect(outcome.status).toBe("non-finite");
  });

  it("reports zero-gradient at critical points", () => {
    const outcome = computeSurfaceAnalysis(
      {
        id: "i-1",
        kind: "implicitSurface",
        color: "#3b82f6",
        visible: true,
        equation: "x^2+y^2+z^2=0",
        domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 },
        resolution: 16,
        appearance: { wireframe: false }
      } as ImplicitSurfaceObject,
      { x: 0, y: 0, z: 0 },
      {}
    );
    expect(outcome.status).toBe("zero-gradient");
  });

  it("reports off-surface for distant points", () => {
    const outcome = computeSurfaceAnalysis(makeSurface("z = x^2 + 2*y^2"), { x: 100, y: 100, z: 0 }, {});
    expect(outcome.status).toBe("off-surface");
  });
});

describe("resolveAnalysisSectionModel (S21 Slice 4)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("empty state gates picking on source compilability", () => {
    const id = addSurface();
    const object = liveObject(id);
    expect(
      resolveAnalysisSectionModel({ object, record: undefined, computeStatus: "idle" })
    ).toEqual({ body: "empty", pickEnabled: true, stale: false });

    useGraphStore.getState().updateSurfaceEquation(id, "zzz");
    const broken = liveObject(id);
    expect(
      resolveAnalysisSectionModel({ object: broken, record: undefined, computeStatus: "idle" })
    ).toEqual({ body: "empty", pickEnabled: false, stale: false });
  });

  it("values, pending, and stale bodies follow freshness", () => {
    const id = addSurface();
    const object = liveObject(id);
    const structure = identityOf(object);
    useGraphStore.getState().setDifferentialAnalysisPoint(id, { x: 1, y: 2, z: 9 }, structure);
    const record = useGraphStore.getState().ui.differentialAnalysisBySourceId[id];
    const values = resolveAnalysisSectionModel({ object, record, computeStatus: "idle" });
    expect(values.body).toBe("values");
    if (values.body === "values") {
      expect(values.gradient.x).toBeCloseTo(-2, 12);
      expect(values.showNormal).toBe(true);
    }

    expect(
      resolveAnalysisSectionModel({ object, record, computeStatus: "pending" }).body
    ).toBe("pending");

    useGraphStore.getState().updateSurfaceEquation(id, "z = x^2 + y^2");
    const edited = liveObject(id);
    const stale = resolveAnalysisSectionModel({ object: edited, record, computeStatus: "idle" });
    expect(stale.body).toBe("diagnostic");
    expect(stale.stale).toBe(true);
  });

  it("isAnalysisSourceCompilable mirrors the sync gate", () => {
    expect(isAnalysisSourceCompilable(makeSurface("z = x^2"))).toBe(true);
    expect(isAnalysisSourceCompilable(makeSurface("zzz"))).toBe(false);
  });
});

describe("DifferentialAnalysisSection rendering (S21 Slice 4)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("shows the empty state with a labelled pick action", () => {
    const id = addSurface();
    render(<DifferentialAnalysisSection object={liveObject(id)} />);
    expect(screen.getByText("Differential Analysis")).toBeDefined();
    expect(screen.getByText("Pick a point on the surface.")).toBeDefined();
    const pick = screen.getByLabelText("Pick analysis point on surface");
    fireEvent.click(pick);
    expect(useGraphStore.getState().ui.differentialAnalysisPickArmedId).toBe(id);
    expect(screen.getByLabelText("Cancel picking analysis point")).toBeDefined();
  });

  it("shows values, toggles, and plane equation for a live record", () => {
    const id = addSurface();
    const object = liveObject(id);
    useGraphStore
      .getState()
      .setDifferentialAnalysisPoint(id, { x: 1, y: 2, z: 9 }, identityOf(object));
    render(<DifferentialAnalysisSection object={liveObject(id)} />);
    expect(screen.getByText(/P = \(1, 2, 9\)/)).toBeDefined();
    // S32: explicit surfaces label the function gradient precisely (implicit
    // surfaces show the level-set normal instead of a merged label).
    expect(screen.getByText(/Function gradient =/)).toBeDefined();
    expect(screen.getByText(/Tangent:/)).toBeDefined();
    const normalSwitch = screen.getByLabelText("Hide normal arrow");
    fireEvent.click(normalSwitch);
    expect(
      useGraphStore.getState().ui.differentialAnalysisBySourceId[id]?.showNormal
    ).toBe(false);
    fireEvent.click(screen.getByLabelText("Clear differential analysis"));
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]).toBeUndefined();
  });

  it("shows the zero-gradient diagnostic without overlays", () => {
    const store = useGraphStore.getState();
    const id = store.addImplicitSurface();
    // Cone apex: x^2 + y^2 - z^2 = 0 at the origin is on-surface with a
    // zero gradient (critical point, not an off-surface pick).
    store.updateImplicitSurfaceExpression(id, "equation", "x^2+y^2-z^2=0");
    const updated = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    if (!updated || updated.kind !== "implicitSurface") {
      throw new Error("implicit missing");
    }
    store.setDifferentialAnalysisPoint(id, { x: 0, y: 0, z: 0 }, identityOf(updated));
    render(<DifferentialAnalysisSection object={updated} />);
    expect(screen.getByText(/gradient is zero/)).toBeDefined();
    expect(screen.queryByLabelText("Hide normal arrow")).toBeNull();
  });

  it("uses editor parameters", () => {
    const previous = useEditorStore.getState().parameters;
    try {
      useEditorStore.setState({
        parameters: [...previous, { id: "a", value: 3, min: 0, max: 10 }]
      });
      const outcome = computeSurfaceAnalysis(makeSurface("z = a*x^2 + y^2"), { x: 2, y: 1, z: 13 }, { a: 3 });
      expect(outcome.status).toBe("ok");
      if (outcome.status !== "ok") return;
      expect(outcome.gradient.x).toBeCloseTo(-12, 10);
    } finally {
      useEditorStore.setState({ parameters: previous });
    }
  });
});
