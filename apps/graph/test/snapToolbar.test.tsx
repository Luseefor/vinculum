import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import Toolbar from "@/components/layout/Toolbar";
import { useGraphStore } from "@/store/graphStore";

describe("Toolbar snap controls", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useGraphStore.getState().setGraphMode("2d");
    useGraphStore.getState().setSnapEnabled(true);
    useGraphStore.getState().setSnapStep(0.25);
  });

  it("toggles snap from 2D toolbar controls", () => {
    render(<Toolbar />);
    const snapToggle = screen.getByRole("checkbox", { name: "Enable snapping" });
    expect(snapToggle).toBeChecked();

    fireEvent.click(snapToggle);
    expect(useGraphStore.getState().ui.snapEnabled).toBe(false);
  });

  it("updates snap step from 2D toolbar controls", () => {
    render(<Toolbar />);
    const snapStep = screen.getByRole("spinbutton", { name: "Snap step" });
    fireEvent.change(snapStep, { target: { value: "0.5" } });
    expect(useGraphStore.getState().ui.snapStep).toBe(0.5);
  });
});
