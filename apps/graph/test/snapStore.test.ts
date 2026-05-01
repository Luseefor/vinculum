import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore } from "@/store/graphStore";

describe("graph snap state", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("starts with snapping enabled and default step", () => {
    const ui = useGraphStore.getState().ui;
    expect(ui.snapEnabled).toBe(true);
    expect(ui.snapStep).toBe(0.25);
  });

  it("toggles snap enabled", () => {
    useGraphStore.getState().setSnapEnabled(false);
    expect(useGraphStore.getState().ui.snapEnabled).toBe(false);
    useGraphStore.getState().setSnapEnabled(true);
    expect(useGraphStore.getState().ui.snapEnabled).toBe(true);
  });

  it("clamps snap step into a safe range", () => {
    useGraphStore.getState().setSnapStep(0);
    expect(useGraphStore.getState().ui.snapStep).toBe(0.0001);

    useGraphStore.getState().setSnapStep(999);
    expect(useGraphStore.getState().ui.snapStep).toBe(100);
  });
});
