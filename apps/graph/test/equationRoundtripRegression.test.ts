import { describe, expect, it } from "vitest";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compilePlaneEquation } from "@/lib/math/samplePlane";
import { validateExpressionSafety } from "@/lib/math/expressionSafety";
import { tryCompileMathExpression } from "@/components/graph/graph2d/graph2dCanvasCompile";
import { tryAppendImplicitRenderableGraph } from "@/components/graph/graph2d/equationRenderableBranches";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import type { RenderableGraph } from "@/components/graph/graph2d/graph2dCanvasTypes";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { createPlaneGraph } from "@/lib/graph/createPlaneGraph";
import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { validateSceneDocument } from "@/lib/scene/validateScene";
import { buildShareSceneUrl, decodeSharedScenePayload } from "@/lib/share/shareSceneLink";
import type { GraphObject } from "@vinculum/scene/types";

// S10-U2: equation syntax / persistence-normalization roundtrip regression
// (TESTS ONLY).
//
// Contract: IF an equation is valid for its object type in the live
// editor/compiler, THEN the canonical RAW scene string must survive
// validation and roundtrip — without weakening generic expression safety.
// Canonical storage stays RAW; only temporary normalization for safety
// checking may happen inside validation (a U3 implementation concern).
//
// Tests marked DESIRED FAIL pre-fix: live accepts, persistence rejects.
// Tests marked CONTROL / SECURITY pass pre-fix and must keep passing.

function validateObjects(objects: GraphObject[]): string[] {
  const scene = createSceneDocument({ metadata: { name: "s10-trace" }, objects });
  return validateSceneDocument(JSON.parse(serializeScene(scene)) as unknown).errors;
}

function deserializeObjects(objects: GraphObject[]) {
  const scene = createSceneDocument({ metadata: { name: "s10-trace" }, objects });
  return deserializeScene(serializeScene(scene));
}

function shareRoundtrip(objects: GraphObject[]) {
  const scene = createSceneDocument({ metadata: { name: "s10-trace" }, objects });
  const built = buildShareSceneUrl({ scene, baseUrl: "http://localhost/editor" });
  expect(built.ok).toBe(true);
  if (!built.ok || !built.url) {
    return null;
  }
  const payload = new URL(built.url).searchParams.get("scene") ?? "";
  return decodeSharedScenePayload(payload);
}

function liveImplicitAppends(equation: string): boolean {
  const obj = createSurfaceGraph({ id: "s10-implicit", equation });
  const graphs: RenderableGraph[] = [];
  return tryAppendImplicitRenderableGraph(graphs, obj, getAxisPairSpec("xy"), equation);
}

describe("S10-U2-B plane z = 0 (DESIRED, fails pre-fix)", () => {
  it("live accepts; validation/deserialize must preserve raw equation", () => {
    expect(compilePlaneEquation("z = 0").error).toBeNull();
    expect(validateObjects([createPlaneGraph({ equation: "z = 0" })])).toEqual([]);
    const back = deserializeObjects([createPlaneGraph({ equation: "z = 0" })]);
    expect(back.valid).toBe(true);
    if (!back.valid || !back.normalizedScene) {
      return;
    }
    const recovered = back.normalizedScene.objects[0];
    expect(recovered?.kind).toBe("plane");
    if (recovered?.kind !== "plane") {
      return;
    }
    expect(recovered.equation).toBe("z = 0");
  });
});

describe("S10-U2-C plane x + y + z = 3 (DESIRED, fails pre-fix)", () => {
  it("live accepts; validation/deserialize must preserve raw equation", () => {
    expect(compilePlaneEquation("x + y + z = 3").error).toBeNull();
    expect(validateObjects([createPlaneGraph({ equation: "x + y + z = 3" })])).toEqual([]);
    const back = deserializeObjects([createPlaneGraph({ equation: "x + y + z = 3" })]);
    expect(back.valid).toBe(true);
    if (!back.valid || !back.normalizedScene) {
      return;
    }
    const recovered = back.normalizedScene.objects[0];
    expect(recovered?.kind).toBe("plane");
    if (recovered?.kind !== "plane") {
      return;
    }
    expect(recovered.equation).toBe("x + y + z = 3");
  });
});

describe("S10-U2-D plane x = 2 (DESIRED, fails pre-fix)", () => {
  it("legitimate plane for plane objects; must survive validation", () => {
    // Object-context distinction: `x = 2` is a valid plane here even
    // though bare `x = 2` is not a valid surface RHS assignment.
    expect(compilePlaneEquation("x = 2").error).toBeNull();
    expect(validateObjects([createPlaneGraph({ equation: "x = 2" })])).toEqual([]);
    const back = deserializeObjects([createPlaneGraph({ equation: "x = 2" })]);
    expect(back.valid).toBe(true);
    if (!back.valid || !back.normalizedScene) {
      return;
    }
    const recovered = back.normalizedScene.objects[0];
    if (recovered?.kind !== "plane") {
      expect(recovered?.kind).toBe("plane");
      return;
    }
    expect(recovered.equation).toBe("x = 2");
  });
});

describe("S10-U2-E implicit 1/x = 1 (DESIRED, fails pre-fix)", () => {
  it("live 2D accepts; validation/deserialize must preserve raw equation", () => {
    expect(liveImplicitAppends("1/x = 1")).toBe(true);
    expect(validateObjects([createSurfaceGraph({ equation: "1/x = 1" })])).toEqual([]);
    const back = deserializeObjects([createSurfaceGraph({ equation: "1/x = 1" })]);
    expect(back.valid).toBe(true);
    if (!back.valid || !back.normalizedScene) {
      return;
    }
    const recovered = back.normalizedScene.objects[0];
    expect(recovered?.kind).toBe("surface");
    if (recovered?.kind !== "surface") {
      return;
    }
    expect(recovered.equation).toBe("1/x = 1");
  });
});

describe("S10-U2-F implicit circle (DESIRED, fails pre-fix)", () => {
  it("live 2D accepts; validation/deserialize must preserve raw equation", () => {
    expect(liveImplicitAppends("x^2 + y^2 = 1")).toBe(true);
    expect(validateObjects([createSurfaceGraph({ equation: "x^2 + y^2 = 1" })])).toEqual([]);
    const back = deserializeObjects([createSurfaceGraph({ equation: "x^2 + y^2 = 1" })]);
    expect(back.valid).toBe(true);
    if (!back.valid || !back.normalizedScene) {
      return;
    }
    const recovered = back.normalizedScene.objects[0];
    if (recovered?.kind !== "surface") {
      expect(recovered?.kind).toBe("surface");
      return;
    }
    expect(recovered.equation).toBe("x^2 + y^2 = 1");
  });
});

describe("S10-U2-G explicit 2D controls (CONTROL, pass pre-fix)", () => {
  it.each(["y = 1/x", "y = x^2"])("%s roundtrips exactly", (equation) => {
    expect(compileSurfaceExpression(equation, "z").error).toBeNull();
    expect(validateObjects([createSurfaceGraph({ equation })])).toEqual([]);
    const back = deserializeObjects([createSurfaceGraph({ equation })]);
    expect(back.valid).toBe(true);
    if (!back.valid || !back.normalizedScene) {
      return;
    }
    const recovered = back.normalizedScene.objects[0];
    if (recovered?.kind !== "surface") {
      expect(recovered?.kind).toBe("surface");
      return;
    }
    expect(recovered.equation).toBe(equation);
  });
});

describe("S10-U2-H 3D explicit surface control (CONTROL, passes pre-fix)", () => {
  it("z = x^2 + y^2 roundtrips with orientation intact", () => {
    const make = () => ({ ...createSurfaceGraph({ equation: "z = x^2 + y^2" }), orientation: "z" as const });
    expect(compileSurfaceExpression("z = x^2 + y^2", "z").error).toBeNull();
    expect(validateObjects([make()])).toEqual([]);
    const back = deserializeObjects([make()]);
    expect(back.valid).toBe(true);
    if (!back.valid || !back.normalizedScene) {
      return;
    }
    const recovered = back.normalizedScene.objects[0];
    if (recovered?.kind !== "surface") {
      expect(recovered?.kind).toBe("surface");
      return;
    }
    expect(recovered.equation).toBe("z = x^2 + y^2");
    expect(recovered.orientation).toBe("z");
  });
});

describe("S10-U2-I orientation explicit controls (CONTROL, pass pre-fix)", () => {
  it.each([
    { equation: "x = y^2 + z^2", orientation: "x" as const },
    { equation: "y = x^2 + z^2", orientation: "y" as const },
    { equation: "z = x^2 + y^2", orientation: "z" as const }
  ])("$equation roundtrips", ({ equation, orientation }) => {
    const make = () => ({ ...createSurfaceGraph({ equation }), orientation });
    expect(validateObjects([make()])).toEqual([]);
    const back = deserializeObjects([make()]);
    expect(back.valid).toBe(true);
    if (!back.valid || !back.normalizedScene) {
      return;
    }
    const recovered = back.normalizedScene.objects[0];
    if (recovered?.kind !== "surface") {
      expect(recovered?.kind).toBe("surface");
      return;
    }
    expect(recovered.equation).toBe(equation);
    expect(recovered.orientation).toBe(orientation);
  });
});

describe("S10-U2-J share roundtrip (DESIRED for plane/implicit, fails pre-fix)", () => {
  it("plane z = 0 survives share encode/decode", () => {
    const decoded = shareRoundtrip([createPlaneGraph({ equation: "z = 0" })]);
    expect(decoded?.ok).toBe(true);
    if (!decoded || !decoded.ok || !decoded.scene) {
      return;
    }
    const recovered = decoded.scene.objects[0];
    expect(recovered?.kind).toBe("plane");
    if (recovered?.kind !== "plane") {
      return;
    }
    expect(recovered.equation).toBe("z = 0");
  });

  it("implicit x^2 + y^2 = 1 survives share encode/decode", () => {
    const decoded = shareRoundtrip([createSurfaceGraph({ equation: "x^2 + y^2 = 1" })]);
    expect(decoded?.ok).toBe(true);
    if (!decoded || !decoded.ok || !decoded.scene) {
      return;
    }
    const recovered = decoded.scene.objects[0];
    if (recovered?.kind !== "surface") {
      expect(recovered?.kind).toBe("surface");
      return;
    }
    expect(recovered.equation).toBe("x^2 + y^2 = 1");
  });

  it("explicit z = x^2 + y^2 share control (CONTROL, passes pre-fix)", () => {
    const decoded = shareRoundtrip([createSurfaceGraph({ equation: "z = x^2 + y^2" })]);
    expect(decoded?.ok).toBe(true);
    if (!decoded || !decoded.ok || !decoded.scene) {
      return;
    }
    expect(decoded.scene.objects[0]?.kind).toBe("surface");
  });
});

describe("S10-U2-K JSON deserialize roundtrip (DESIRED for plane/implicit, fails pre-fix)", () => {
  it("plane z = 0 deserializes with exact equation", () => {
    const back = deserializeObjects([createPlaneGraph({ equation: "z = 0" })]);
    expect(back.valid).toBe(true);
    if (!back.valid || !back.normalizedScene) {
      return;
    }
    const recovered = back.normalizedScene.objects[0];
    if (recovered?.kind !== "plane") {
      expect(recovered?.kind).toBe("plane");
      return;
    }
    expect(recovered.equation).toBe("z = 0");
  });

  it("implicit x^2 + y^2 = 1 deserializes with exact equation", () => {
    const back = deserializeObjects([createSurfaceGraph({ equation: "x^2 + y^2 = 1" })]);
    expect(back.valid).toBe(true);
    if (!back.valid || !back.normalizedScene) {
      return;
    }
    const recovered = back.normalizedScene.objects[0];
    if (recovered?.kind !== "surface") {
      expect(recovered?.kind).toBe("surface");
      return;
    }
    expect(recovered.equation).toBe("x^2 + y^2 = 1");
  });
});

describe("S10-U2-L surface security (SECURITY, passes pre-fix)", () => {
  // Only pin forms the LIVE surface compiler itself rejects: persistence
  // must match live exactly. Forms live accepts via orientation override
  // (`x = 2` -> x-oriented) or implicit-strip (`a = 5`, `f(x) = x^2` ->
  // constant/RHS bodies) are NOT rejection cases for surfaces. Likewise
  // `2 = x` is accepted post-fix: the live 2D implicit grammar renders it
  // as the x = 2 line, so validation consistency requires acceptance
  // (U3-D conditions rejection on live-grammar rejection).
  it.each([{ label: "chained equals", equation: "x = y = 1" }])(
    "live and validation both reject $label",
    ({ equation }) => {
      expect(compileSurfaceExpression(equation, "z").error).not.toBeNull();
      expect(validateObjects([createSurfaceGraph({ equation })]).length).toBeGreaterThan(0);
    }
  );

  it("reversed form 2 = x is accepted for 2D-implicit consistency", () => {
    // U3-D conditions surface/implicit rejection on live-grammar rejection.
    // The live 3D explicit compiler rejects `2 = x`, but the live 2D
    // implicit grammar accepts it (renders the x = 2 line), exactly like
    // `1/x = 1`. Validation follows the permissive live path so the object
    // persists wherever it renders.
    expect(validateObjects([createSurfaceGraph({ equation: "2 = x" })])).toEqual([]);
  });

  it("orientation override x = 2 stays a consistent accept (CONTROL)", () => {
    expect(compileSurfaceExpression("x = 2", "z").error).toBeNull();
    expect(validateObjects([createSurfaceGraph({ equation: "x = 2" })])).toEqual([]);
  });
});

describe("S10-U2-M plane security (SECURITY, passes pre-fix)", () => {
  it.each([
    { label: "function assignment", equation: "f(x) = x^2" },
    { label: "chained equals", equation: "x = y = 1" },
    { label: "missing rhs", equation: "x =" },
    { label: "missing lhs", equation: "= 1" }
  ])("plane validation rejects $label", ({ equation }) => {
    expect(validateObjects([createPlaneGraph({ equation })]).length).toBeGreaterThan(0);
  });

  it("nonlinear z = x^2 stays rejected by validation (linearity guard)", () => {
    // Live rejects via the plane linearity requirement, not via generic
    // safety. Validation must not accidentally bless every safe equation
    // as a plane: U3 normalization must preserve this rejection.
    expect(compilePlaneEquation("z = x^2").error).not.toBeNull();
    expect(validateObjects([createPlaneGraph({ equation: "z = x^2" })]).length).toBeGreaterThan(0);
  });
});

describe("S10-U2-N implicit security (SECURITY, passes pre-fix)", () => {
  it.each([
    { label: "chained equals", equation: "x = y = 1" },
    { label: "missing rhs", equation: "x =" },
    { label: "missing lhs", equation: "= 1" }
  ])("surface validation rejects $label", ({ equation }) => {
    expect(validateObjects([createSurfaceGraph({ equation })]).length).toBeGreaterThan(0);
  });

  it("side with unsupported function stays rejected", () => {
    // The future fix must validate each mathematical side: the gamma side
    // is unsafe regardless of splitting. (Depth-1 traversal catches it;
    // see S10-U2 report on the depth-2+ forEach limitation.)
    expect(validateObjects([createSurfaceGraph({ equation: "sin(x) + factorial(y) = 1" })]).length).toBeGreaterThan(0);
    expect(tryCompileMathExpression("sin(x) + factorial(y)")).toBeNull();
  });
});

describe("S10-U2-O multiple equals guard (SECURITY, passes pre-fix)", () => {
  it("x = y = 1 rejected in surface validation (RHS must not smuggle assignment)", () => {
    expect(validateObjects([createSurfaceGraph({ equation: "x = y = 1" })]).length).toBeGreaterThan(0);
  });

  it("x = y = 1 rejected in plane validation", () => {
    expect(validateObjects([createPlaneGraph({ equation: "x = y = 1" })]).length).toBeGreaterThan(0);
  });
});

describe("S10-U2-P function assignment guard (SECURITY, passes pre-fix)", () => {
  it("f(x) = x^2 rejected by plane validation and raw safety", () => {
    expect(validateObjects([createPlaneGraph({ equation: "f(x) = x^2" })]).length).toBeGreaterThan(0);
    const safety = validateExpressionSafety("f(x) = x^2", { operation: "s10", expressionLabel: "s10" });
    expect(safety.ok).toBe(false);
    if (safety.ok) {
      return;
    }
    expect(safety.violation.code).toBe("expression-disallowed-node");
  });

  it("f(x) = x^2 rejected by the 2D helper", () => {
    expect(tryCompileMathExpression("f(x) = x^2")).toBeNull();
  });
});

describe("S10-U2-Q malformed equations (SECURITY, passes pre-fix)", () => {
  it.each([
    { kind: "surface" as const, equation: "x =" },
    { kind: "surface" as const, equation: "= 1" },
    { kind: "plane" as const, equation: "x =" },
    { kind: "plane" as const, equation: "= 1" }
  ])("$kind rejects $equation", ({ kind, equation }) => {
    const objects = kind === "surface" ? [createSurfaceGraph({ equation })] : [createPlaneGraph({ equation })];
    expect(validateObjects(objects).length).toBeGreaterThan(0);
  });

  it("surface rejects x == 1 via orientation-strip syntax (CONTROL)", () => {
    expect(compileSurfaceExpression("x == 1", "z").error).not.toBeNull();
    expect(validateObjects([createSurfaceGraph({ equation: "x == 1" })]).length).toBeGreaterThan(0);
  });

  it("plane x == 1 must match live rejection (DESIRED, fails pre-fix)", () => {
    // Live plane compiler rejects (compile throw on the `(x) - (= 1)`
    // split), but validation currently accepts the raw OperatorNode.
    // Consistency (U2-R) requires validation to reject it too.
    expect(compilePlaneEquation("x == 1").error).not.toBeNull();
    expect(validateObjects([createPlaneGraph({ equation: "x == 1" })]).length).toBeGreaterThan(0);
  });
});

describe("S10-U2-T parametric control (CONTROL, passes pre-fix)", () => {
  it("bare expressions roundtrip; equation-style axis stays rejected", () => {
    const good = createParametricCurve({ xExpr: "cos(t)", yExpr: "sin(t)", zExpr: "t", tMin: 0, tMax: 1, samples: 8 });
    expect(validateObjects([good])).toEqual([]);
    const back = deserializeObjects([good]);
    expect(back.valid).toBe(true);

    const bad = createParametricCurve({ xExpr: "x = cos(t)", yExpr: "sin(t)", zExpr: "t", tMin: 0, tMax: 1, samples: 8 });
    expect(validateObjects([bad]).length).toBeGreaterThan(0);
  });
});
