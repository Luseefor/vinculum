import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import AddObjectMenu from "@/components/objects/AddObjectMenu";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";

describe("AddObjectMenu", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useEditorStore.setState({ consoleEvents: [] });
  });

  it("creates a sphere cap surface template", () => {
    render(<AddObjectMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Open object menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Sphere Cap" }));

    const objects = useGraphStore.getState().scene.objects;
    const created = objects[objects.length - 1];
    expect(created.kind).toBe("surface");
    if (created.kind === "surface") {
      expect(created.equation).toContain("sqrt");
      expect(created.domain.xMin).toBe(-3);
      expect(created.domain.xMax).toBe(3);
    }
  });

  it("projects selected parametric curve onto z=0", () => {
    const id = useGraphStore.getState().addParametricCurve();
    useGraphStore.getState().selectObject(id);

    const beforeCount = useGraphStore.getState().scene.objects.length;
    render(<AddObjectMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Open object menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Projection" }));

    const objects = useGraphStore.getState().scene.objects;
    expect(objects.length).toBe(beforeCount + 1);
    const created = objects[objects.length - 1];
    expect(created.kind).toBe("parametricCurve");
    if (created.kind === "parametricCurve") {
      expect(created.zExpr).toBe("0");
    }
  });
});
