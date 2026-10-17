import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ImplicitCurveObject } from "@vinculum/scene/types";
import { CurveExtensionDefinitionEditor } from "@/components/inspector/MathDefinitionEditors";
import { extendCurveToSurface } from "@/lib/math/curves/curveExtension";
import { compileImplicitSurfaceExpression } from "@/lib/math/expressions/compileImplicitSurface";
import { useGraphStore } from "@/store/graphStore";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { serializeScene } from "@/lib/scene/serializeScene";

const curve: ImplicitCurveObject = { id: "curve", kind: "implicitCurve", equation: "cos(x)", color: "#3080ef", visible: true, extendTo3D: true };
beforeEach(() => { useGraphStore.getState().resetScene(); useGraphStore.getState().addDefinedObject(curve); });
const source = () => useGraphStore.getState().scene.objects[0] as ImplicitCurveObject;

describe("finite Z extension", () => {
  it("extrudes the plotted y=f(x) relation with persisted Z bounds", () => {
    useGraphStore.getState().updateCurveExtensionRange(curve.id, { zMin: 2, zMax: 9 });
    const surface = extendCurveToSurface(source(), { xMin: 20, xMax: 30, yMin: -10, yMax: 10 });
    expect(surface.domain).toEqual({ xMin: 20, xMax: 30, yMin: -10, yMax: 10, zMin: 2, zMax: 9 });
    expect(compileImplicitSurfaceExpression(surface.equation, {}).evaluator(0, 1, 5)).toBeCloseTo(0);
    const restored = deserializeScene(serializeScene(useGraphStore.getState().scene));
    expect(restored.valid).toBe(true);
    expect(restored.normalizedScene!.objects[0]).toMatchObject({ extensionRange: { zMin: 2, zMax: 9 } });
    const clone = JSON.parse(serializeScene(useGraphStore.getState().scene));
    clone.objects[0].extensionRange = { zMin: 9, zMax: 2 };
    expect(deserializeScene(JSON.stringify(clone)).valid).toBe(false);
  });
  it("edits min/max and rejects inverted, nonfinite and excessive bounds", () => {
    const { rerender } = render(<CurveExtensionDefinitionEditor object={source()} />);
    const commit = (label: string, value: string) => { const input = screen.getByLabelText(label); fireEvent.change(input, { target: { value } }); fireEvent.blur(input); rerender(<CurveExtensionDefinitionEditor object={source()} />); };
    commit("z min", "2"); commit("z max", "9");
    expect(source().extensionRange).toEqual({ zMin: 2, zMax: 9 });
    commit("z min", "10");
    expect(screen.getByText(/Use Z min < Z max/)).toBeVisible();
    expect(source().extensionRange).toEqual({ zMin: 2, zMax: 9 });
    useGraphStore.getState().updateCurveExtensionRange(curve.id, { zMax: Infinity });
    useGraphStore.getState().updateCurveExtensionRange(curve.id, { zMin: -1e7 });
    expect(source().extensionRange).toEqual({ zMin: 2, zMax: 9 });
  });
});
