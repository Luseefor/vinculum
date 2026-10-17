import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useGraphStore } from "@/store/graphStore";
import GeometryCoordinateFields from "@/components/objects/GeometryCoordinateFields";

describe("GeometryCoordinateFields (S26 PART 25/51)", () => {
  it("edits vector coordinates with accessible labels and live status", () => {
    useGraphStore.getState().resetScene();
    const id = useGraphStore.getState().addVectorObject();
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    expect(object?.kind).toBe("vector");
    render(<GeometryCoordinateFields object={object as never} />);
    expect(screen.getByLabelText("Vector origin x")).toBeInTheDocument();
    expect(screen.getByLabelText("Vector component z")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Magnitude/);
    fireEvent.change(screen.getByLabelText("Vector component x"), { target: { value: "9" } });
    const updated = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    expect(updated?.kind === "vector" && updated.vxExpr).toBe("9");
  });

  it("reports zero-vector and nonzero-direction states precisely", () => {
    useGraphStore.getState().resetScene();
    const vectorId = useGraphStore.getState().addVectorObject();
    useGraphStore.getState().updateGeometryCoordinate(vectorId, "vxExpr", "0");
    useGraphStore.getState().updateGeometryCoordinate(vectorId, "vyExpr", "0");
    useGraphStore.getState().updateGeometryCoordinate(vectorId, "vzExpr", "0");
    const zero = useGraphStore.getState().scene.objects.find((o) => o.id === vectorId);
    const { unmount } = render(<GeometryCoordinateFields object={zero as never} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Zero vector/);
    unmount();
    const lineId = useGraphStore.getState().addLineObject();
    useGraphStore.getState().updateGeometryCoordinate(lineId, "dxExpr", "0");
    useGraphStore.getState().updateGeometryCoordinate(lineId, "dyExpr", "0");
    useGraphStore.getState().updateGeometryCoordinate(lineId, "dzExpr", "0");
    const line = useGraphStore.getState().scene.objects.find((o) => o.id === lineId);
    render(<GeometryCoordinateFields object={line as never} />);
    expect(screen.getByRole("status")).toHaveTextContent(/nonzero/i);
  });

  it("surfaces invalid coordinate expressions without crashing", () => {
    useGraphStore.getState().resetScene();
    const id = useGraphStore.getState().addRayObject();
    useGraphStore.getState().updateGeometryCoordinate(id, "dxExpr", "x");
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    render(<GeometryCoordinateFields object={object as never} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
