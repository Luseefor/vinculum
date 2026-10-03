import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { getEquationParameterNames, getEditorParameterScope } from "@/lib/store/editorParameters";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import ParameterSliders from "@/components/expressions/ParameterSliders";

beforeEach(() => { useGraphStore.getState().resetScene(); useEditorStore.setState({ parameters: [] }); });
describe("equation parameters", () => {
  it("discovers scalar names without treating coordinates, constants, or functions as sliders", () => {
    expect(getEquationParameterNames("f(x,y)=a*cos(x)+b*y+pi")).toEqual(["a", "b"]);
    expect(getEquationParameterNames("x=a*unknown(y)")).toEqual([]);
    expect(getEquationParameterNames("x=a+")).toEqual([]);
  });
  it.each(["y=a*x+b", "z=a*x^2+b*y^2"])("creates sliders and renders %s", equation => {
    expect(useGraphStore.getState().commitAutoEquation(equation).error).toBeNull();
    expect(getEditorParameterScope()).toEqual({ a: 1, b: 1 });
    render(<ParameterSliders />);
    expect(screen.getByRole("slider", { name: "a slider" })).toHaveValue("1");
    fireEvent.change(screen.getByRole("slider", { name: "a slider" }), { target: { value: "3" } });
    expect(getEditorParameterScope().a).toBe(3);
    if (equation.startsWith("z")) expect(compileSurfaceExpression(equation).evaluator(2, 1)).toBe(13);
    else {
      const graphs = buildRenderableGraphsFromScene(useGraphStore.getState().scene.objects, { horizontal: "x", vertical: "y", horizontalLabel: "X", verticalLabel: "Y" }, getEditorParameterScope());
      expect(graphs[0].evaluate?.(2)).toBe(7);
    }
  });
  it("defines a parameter without adding a fake graph and expands its bounds", () => {
    expect(useGraphStore.getState().commitAutoEquation("a=20")).toMatchObject({ error: null, parameterId: "a" });
    expect(useGraphStore.getState().scene.objects).toHaveLength(0);
    expect(useEditorStore.getState().parameters[0]).toMatchObject({ id: "a", value: 20, max: 20 });
    render(<ParameterSliders />);
    expect(screen.getByRole("slider", { name: "a slider" })).toHaveValue("20");
  });
  it("leaves parameter values alone when an equation is invalid", () => {
    expect(useGraphStore.getState().commitAutoEquation("z=a*bad(x)").error).toBeTruthy();
    expect(useEditorStore.getState().parameters).toEqual([]);
  });
  it("accepts a parameterized scene after loading without the original editor scope", () => {
    useGraphStore.getState().commitAutoEquation("y=a*x+b");
    const serialized = serializeScene(useGraphStore.getState().scene);
    useEditorStore.setState({ parameters: [] });
    expect(deserializeScene(serialized).valid).toBe(true);
    render(<ParameterSliders />);
    expect(screen.getByRole("slider", { name: "b slider" })).toBeInTheDocument();
  });

  it("creates and loads parameterized 3D implicit equations without pre-existing sliders", () => {
    expect(useGraphStore.getState().commitAutoEquation("a*x^2+y^2+z^2=4")).toMatchObject({ error: null, dimension: "3d" });
    expect(useGraphStore.getState().scene.objects[0].kind).toBe("implicitSurface");
    const serialized = serializeScene(useGraphStore.getState().scene);
    useEditorStore.setState({ parameters: [] });
    expect(deserializeScene(serialized).valid).toBe(true);
  });

});
