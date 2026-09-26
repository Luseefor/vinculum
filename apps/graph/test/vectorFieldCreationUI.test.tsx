import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import GraphTypeSelector from "@/components/expressions/GraphTypeSelector";
import ExpressionRow from "@/components/expressions/ExpressionRow";
import { moreAddDescriptors, quickAddDescriptors } from "@/lib/objects/objectDescriptors";
import { getVectorFieldComponentDiagnostics } from "@/lib/math/expressionDiagnostics";
import { createVectorFieldGraph } from "@/lib/graph/createVectorFieldGraph";

const rowProps = {
  isSelected: true,
  canRemoveWithBackspace: false,
  registerInputRef: () => undefined,
  onSelect: () => undefined,
  onMoveFocus: () => undefined,
  onInsertBelow: () => undefined,
  onRemove: () => undefined,
  onOpenInspector: () => undefined
};

describe("vector field creation surfaces (S20 Slice 6b)", () => {
  it("offers 2D and 3D vector fields in the graph type selector", () => {
    render(<GraphTypeSelector value="surface" onChange={() => undefined} />);
    const select = screen.getByLabelText("Graph type") as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toContain("vectorField:2d");
    expect(values).toContain("vectorField:3d");
  });

  it("reflects the current field dimension in the selector value", () => {
    const { rerender } = render(<GraphTypeSelector value="vectorField" dimension="3d" onChange={() => undefined} />);
    expect((screen.getByLabelText("Graph type") as HTMLSelectElement).value).toBe("vectorField:3d");
    rerender(<GraphTypeSelector value="vectorField" onChange={() => undefined} />);
    expect((screen.getByLabelText("Graph type") as HTMLSelectElement).value).toBe("vectorField:2d");
  });

  it("prioritizes vector fields in Math Lab Quick Add without displacing Geometry Studio", () => {
    expect(quickAddDescriptors("math").map((entry) => entry.label)).toContain("2D Vector Field");
    expect(quickAddDescriptors("math").map((entry) => entry.label)).toContain("3D Vector Field");
    for (const workspace of ["geometry", "math"] as const) {
      const reachable = [
        ...quickAddDescriptors(workspace).map((entry) => entry.key),
        ...moreAddDescriptors(workspace).map((entry) => entry.key)
      ];
      expect(reachable).toContain("vectorField-2d");
      expect(reachable).toContain("vectorField-3d");
    }
    // S30: in Geometry Studio both fields sit behind More, ordered after
    // the graph kinds (fields never displace geometry primitives).
    const geometryMore = moreAddDescriptors("geometry").map((entry) => entry.key);
    expect(geometryMore.indexOf("vectorField-3d")).toBeGreaterThan(geometryMore.indexOf("implicitSurface"));
  });

  it("renders P/Q inputs for 2D fields and P/Q/R for 3D fields", () => {
    const field2D = createVectorFieldGraph({ dimension: "2d" });
    const { unmount } = render(<ExpressionRow object={field2D} {...rowProps} />);
    expect(screen.getByLabelText("P component")).toHaveValue("x");
    expect(screen.getByLabelText("Q component")).toHaveValue("y");
    expect(screen.queryByLabelText("R component")).toBeNull();
    unmount();

    const field3D = createVectorFieldGraph({ dimension: "3d" });
    render(<ExpressionRow object={field3D} {...rowProps} />);
    expect(screen.getByLabelText("P component")).toHaveValue("x");
    expect(screen.getByLabelText("Q component")).toHaveValue("y");
    expect(screen.getByLabelText("R component")).toHaveValue("z");
  });

  it("wires Q/R keyboard paths: Escape reverts, Enter inserts below (S20-R2)", () => {
    const field2D = createVectorFieldGraph({ dimension: "2d" });
    const onInsertBelow = vi.fn();
    render(<ExpressionRow object={field2D} {...rowProps} onInsertBelow={onInsertBelow} />);
    const qInput = screen.getByLabelText("Q component") as HTMLInputElement;
    fireEvent.change(qInput, { target: { value: "zzz" } });
    expect(qInput.value).toBe("zzz");
    fireEvent.keyDown(qInput, { key: "Escape" });
    expect(qInput.value).toBe("y");

    fireEvent.change(qInput, { target: { value: "x" } });
    fireEvent.keyDown(qInput, { key: "Enter" });
    expect(onInsertBelow).toHaveBeenCalledWith(field2D.id, "vectorField", "2d");
  });

  it("diagnoses vector components per field with dimension-aware locals", () => {
    expect(
      getVectorFieldComponentDiagnostics({
        field: "pExpr",
        dimension: "2d",
        pExpr: "x",
        qExpr: "y",
        rExpr: ""
      }).status
    ).toBe("valid");
    const reserved = getVectorFieldComponentDiagnostics({
      field: "pExpr",
      dimension: "2d",
      pExpr: "t",
      qExpr: "y",
      rExpr: ""
    });
    expect(reserved.status).toBe("error");
    const unknown = getVectorFieldComponentDiagnostics({
      field: "qExpr",
      dimension: "3d",
      pExpr: "x",
      qExpr: "zzz",
      rExpr: "z"
    });
    expect(unknown.status).toBe("error");
    expect(unknown.fieldContext).toBe("vectorField.qExpr");
    // Empty components stay quiet (valid-but-unrendered downstream).
    expect(
      getVectorFieldComponentDiagnostics({
        field: "pExpr",
        dimension: "2d",
        pExpr: "",
        qExpr: "y",
        rExpr: ""
      }).status
    ).toBe("valid");
  });
});
