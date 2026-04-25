import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import Toolbar from "@/components/layout/Toolbar";
import { useGraphStore } from "@/store/graphStore";

describe("Toolbar mode switch", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useGraphStore.getState().setGraphMode("2d");
  });

  it("switches from 2D to 3D on click", () => {
    render(<Toolbar />);

    fireEvent.click(screen.getByRole("button", { name: "3D" }));

    expect(useGraphStore.getState().ui.graphMode).toBe("3d");
  });

  it("switches from 3D back to 2D on click", () => {
    useGraphStore.getState().setGraphMode("3d");
    render(<Toolbar />);

    fireEvent.click(screen.getByRole("button", { name: "2D" }));

    expect(useGraphStore.getState().ui.graphMode).toBe("2d");
  });
});

describe("Toolbar new scene dialog", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("opens confirmation dialog when scene has objects", () => {
    useGraphStore.getState().addParametricCurve();
    expect(useGraphStore.getState().scene.objects.length).toBeGreaterThan(0);

    render(<Toolbar />);

    fireEvent.click(screen.getByRole("button", { name: "New" }));

    expect(screen.getByTestId("new-scene-dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /new scene/i })).toBeInTheDocument();
  });

  it("resets scene when new scene is confirmed", () => {
    useGraphStore.getState().addParametricCurve();
    const beforeCount = useGraphStore.getState().scene.objects.length;

    render(<Toolbar />);
    fireEvent.click(screen.getByRole("button", { name: "New" }));

    fireEvent.click(screen.getByRole("button", { name: "Create new scene" }));

    expect(screen.queryByTestId("new-scene-dialog")).not.toBeInTheDocument();
    expect(useGraphStore.getState().scene.objects.length).toBeLessThan(beforeCount);
  });

  it("closes dialog on cancel without resetting", () => {
    useGraphStore.getState().addParametricCurve();
    const countBefore = useGraphStore.getState().scene.objects.length;

    render(<Toolbar />);
    fireEvent.click(screen.getByRole("button", { name: "New" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByTestId("new-scene-dialog")).not.toBeInTheDocument();
    expect(useGraphStore.getState().scene.objects.length).toBe(countBefore);
  });
});
