import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FieldSolverDialog from "@/components/inspector/FieldSolverDialog";
import AutomaticFieldAnalysis from "@/components/inspector/AutomaticFieldAnalysis";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";

describe("automatic solution UI", () => {
  beforeEach(() => { useGraphStore.getState().resetScene(); useEditorStore.setState({ parameters: [] }); });
  it("solves a vector automatically without point inputs and opens derivation steps", async () => {
    const id = useGraphStore.getState().addVectorFieldObject("3d");
    const object = useGraphStore.getState().scene.objects.find((entry) => entry.id === id)!;
    if (object.kind !== "vectorField") throw new Error("Expected vector field");
    render(<AutomaticFieldAnalysis object={{ ...object, pExpr: "-y", qExpr: "x", rExpr: "0" }} />);
    await waitFor(() => expect(screen.getByTestId("symbolic-curl").textContent).toBe("<0, 0, 2>"));
    expect(screen.queryByLabelText("Analysis point x")).toBeNull();
    const trigger = screen.getByRole("button", { name: "Show curl solution" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Curl solution" })).toBeDefined();
    expect(screen.getByTestId("solution-final-answer").textContent).toBe("<0, 0, 2>");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
  it("refreshes answers after definition changes and reports unsupported inputs", async () => {
    render(<FieldSolverDialog open onOpenChange={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("symbolic-curl").textContent).toBe("<0, 0, 2>"));
    fireEvent.change(screen.getByLabelText("P(x,y,z)"), { target: { value: "-2*y" } });
    expect(screen.getByText("Solving…")).toBeDefined();
    await waitFor(() => expect(screen.getByTestId("symbolic-curl").textContent).toBe("<0, 0, 3>"));
    fireEvent.change(screen.getByLabelText("P(x,y,z)"), { target: { value: "factorial(x)" } });
    await waitFor(() => expect(screen.getByText(/Unsupported function/)).toBeDefined());
    expect(screen.queryByTestId("symbolic-curl")).toBeNull();
    expect(screen.getByRole("button", { name: "Add to scene" })).toBeDisabled();
  });
  it("solves polar inputs, preserves drafts on switching, and displays steps in the solver overlay", async () => {
    render(<FieldSolverDialog open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText("Field coordinates"), { target: { value: "polar" } });
    await waitFor(() => expect(screen.getByTestId("symbolic-divergence").textContent).toBe("2"));
    fireEvent.change(screen.getByLabelText("Radial component Fᵣ(r,theta)"), { target: { value: "2*r" } });
    await waitFor(() => expect(screen.getByTestId("symbolic-divergence").textContent).toBe("4"));
    fireEvent.click(screen.getByRole("button", { name: "Show divergence solution" }));
    expect(screen.getByTestId("solution-final-answer").textContent).toBe("4");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Back to answers" }));
    fireEvent.change(screen.getByLabelText("Field coordinates"), { target: { value: "cartesian" } });
    fireEvent.change(screen.getByLabelText("Field coordinates"), { target: { value: "polar" } });
    expect(screen.getByLabelText("Radial component Fᵣ(r,theta)")).toHaveValue("2*r");
  });
  it("checks complex functions and adds a real canonical field to the scene", async () => {
    render(<FieldSolverDialog open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText("Field problem"), { target: { value: "complex" } });
    await waitFor(() => expect(screen.getByTestId("symbolic-cauchy–riemann-residuals").textContent).toBe("<0, 0>"));
    fireEvent.click(screen.getByRole("button", { name: "Add to scene" }));
    expect(useGraphStore.getState().scene.objects).toHaveLength(1);
    const field = useGraphStore.getState().scene.objects[0]!;
    expect(field.kind).toBe("vectorField");
  });
});
