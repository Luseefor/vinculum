import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AddObjectMenu from "@/components/objects/AddObjectMenu";
import { createObjectByKey, createSpherePreset, revealObjectInViewport } from "@/lib/objects/objectCreation";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";
import { serializeScene } from "@/lib/scene/serializeScene";

beforeEach(() => {
  const store = useGraphStore.getState();
  store.resetScene();
  store.setWorkspace("math");
  store.setGraphMode("2d");
  store.setActive2dViewport("primary");
  store.setAxis2DPair("xz");
  useEditorStore.getState().setViewportMode("2d");
});

describe("object creation reveals the result", () => {
  it.each(["surface", "implicitSurface", "parametricSurface", "parametricCurve", "point", "vector", "line", "ray", "segment", "plane", "vectorField-3d", "linearTransform-3d"])("shows %s in 3D with its original selection and focus", key => {
    const id = createObjectByKey(key);
    const state = useGraphStore.getState();
    expect(state.ui.graphMode).toBe("3d");
    expect(useEditorStore.getState().viewportMode).toBe("3d");
    expect(state.ui.selectedObjectId).toBe(id);
    expect(state.ui.focusEquationForObjectId).toBe(id);
    expect(state.scene.objects).toHaveLength(1);
  });

  it.each(["vectorField-2d", "linearTransform-2d"])("reveals %s on XY when created in Geometry Studio", key => {
    useGraphStore.getState().setWorkspace("geometry");
    useGraphStore.getState().setGraphMode("3d");
    useEditorStore.getState().setViewportMode("3d");
    createObjectByKey(key);
    const state = useGraphStore.getState();
    expect(state.ui.workspace).toBe("math");
    expect(state.ui.graphMode).toBe("2d");
    expect(state.ui.axis2dPair).toBe("xy");
    expect(useEditorStore.getState().viewportMode).toBe("2d");
  });

  it.each(["split", "quad"] as const)("keeps the %s layout while adding planar and spatial objects", layout => {
    useEditorStore.getState().setViewportMode(layout);
    createObjectByKey("parametricSurface");
    expect(useEditorStore.getState().viewportMode).toBe(layout);
    createObjectByKey("vectorField-2d");
    expect(useEditorStore.getState().viewportMode).toBe(layout);
  });

  it.each(["split", "quad"] as const)("keeps the %s layout when a surface definition becomes planar", layout => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    useEditorStore.getState().setViewportMode(layout);
    store.updateSurfaceEquation(id, "x^2+y^2=4");
    expect(useGraphStore.getState().scene.objects[0].kind).toBe("implicitCurve");
    expect(useEditorStore.getState().viewportMode).toBe(layout);
  });

  it("keeps Geometry Studio active for spatial creation", () => {
    useGraphStore.getState().setWorkspace("geometry");
    createObjectByKey("parametricSurface");
    expect(useGraphStore.getState().ui.workspace).toBe("geometry");
    expect(useGraphStore.getState().ui.graphMode).toBe("2d");
  });

  it("reveals presets and never changes scene data when navigating back to an object", () => {
    const id = createSpherePreset();
    const before = serializeScene(useGraphStore.getState().scene);
    useGraphStore.getState().setGraphMode("2d");
    useEditorStore.getState().setViewportMode("2d");
    revealObjectInViewport(id);
    expect(useGraphStore.getState().ui.graphMode).toBe("3d");
    expect(serializeScene(useGraphStore.getState().scene)).toBe(before);
  });

  it.each([false, true])("reveals an equation curve with extendTo3D=%s in its intended view", extendTo3D => {
    const store = useGraphStore.getState();
    const result = store.addDefinedObject({ id: "extended", kind: "implicitCurve", equation: "x^2+y^2=4", color: "#123456", visible: true, extendTo3D });
    expect(result.error).toBeNull();
    if (!result.id) throw new Error("Expected inserted curve");
    const before = serializeScene(useGraphStore.getState().scene);
    revealObjectInViewport(result.id);
    const mode = extendTo3D ? "3d" : "2d";
    expect(useGraphStore.getState().ui.graphMode).toBe(mode);
    expect(useEditorStore.getState().viewportMode).toBe(mode);
    expect(serializeScene(useGraphStore.getState().scene)).toBe(before);
  });

  it.each(["2d", "3d"] as const)("keeps a blank expression in the current %s view", mode => {
    useGraphStore.getState().setGraphMode(mode);
    useEditorStore.getState().setViewportMode(mode);
    render(<AddObjectMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Open object menu" }));
    fireEvent.click(screen.getByRole("button", { name: /Empty expression/ }));
    expect(useGraphStore.getState().ui.graphMode).toBe(mode);
  });
});

describe("view state and measurement coordinates", () => {
  it("preserves camera reset version, independent tools, and scene data across 2D/3D switches", () => {
    const store = useGraphStore.getState();
    store.addSurfaceObject();
    store.updateViewport2D({ centerX: 8, centerY: -3, scale: 91 });
    store.setCanvas2dTool("measureDistance");
    store.setCanvas3dTool("probe");
    store.setProbePinnedMath({ horizontal: 1, vertical: 2 });
    const before = useGraphStore.getState();
    expect(before.ui.measurementDraft).not.toBeNull();
    store.setGraphMode("3d");
    store.setGraphMode("2d");
    const after = useGraphStore.getState();
    expect(after.cameraResetVersion).toBe(before.cameraResetVersion);
    expect(after.ui.viewport2d).toEqual(before.ui.viewport2d);
    expect(after.ui.canvas2dTool).toBe("measureDistance");
    expect(after.ui.canvas3dTool).toBe("probe");
    expect(after.ui.measurementDraft).toBeNull();
    expect(after.scene).toBe(before.scene);
    store.requestCameraReset();
    expect(useGraphStore.getState().cameraResetVersion).toBe(before.cameraResetVersion + 1);
  });

  it.each(["xy", "xz", "yz"] as const)("pins in the originating %s pane instead of the primary pane", pair => {
    const store = useGraphStore.getState();
    store.setCanvas2dTool("addPin");
    store.setProbePinnedMath({ horizontal: 2, vertical: 3 }, pair);
    const pin = useGraphStore.getState().scene.measurements[0];
    expect(pin.kind).toBe("pin");
    if (pin.kind !== "pin") throw new Error("Expected pin");
    expect(pin.point).toEqual(pair === "xy" ? { x: 2, y: 3, z: 0 } : pair === "xz" ? { x: 2, y: 0, z: 3 } : { x: 0, y: 2, z: 3 });
  });
});

it("explains the unavailable Projection action, then projects the selected curve", () => {
  const view = render(<AddObjectMenu />);
  fireEvent.click(screen.getByRole("button", { name: "Open object menu" }));
  expect(screen.getByRole("button", { name: "Projection" })).toBeDisabled();
  expect(screen.getByText("Select a parametric curve first")).toBeVisible();
  view.unmount();
  createObjectByKey("parametricCurve");
  render(<AddObjectMenu />);
  fireEvent.click(screen.getByRole("button", { name: "Open object menu" }));
  fireEvent.click(screen.getByRole("button", { name: "Projection" }));
  const objects = useGraphStore.getState().scene.objects;
  expect(objects).toHaveLength(2);
  expect(objects[1]).toMatchObject({ kind: "parametricCurve", zExpr: "0" });
});

it("closes the object picker on Escape when a browser leaves category clicks unfocused", () => {
  render(<AddObjectMenu />);
  const trigger = screen.getByRole("button", { name: "Open object menu" });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: "Analysis" }));
  screen.getByRole("searchbox", { name: "Search objects" }).blur();
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Add to graph" })).toBeNull();
  expect(trigger).toHaveFocus();
});

it("recovers a planar field from Geometry Studio through the shared 3D notice", async () => {
  const { default: PlanarFieldNotice } = await import("@/components/viewport/PlanarFieldNotice");
  useGraphStore.getState().addVectorFieldObject("2d");
  useGraphStore.getState().setWorkspace("geometry");
  render(<PlanarFieldNotice />);
  fireEvent.click(screen.getByRole("button", { name: "Show in 2D" }));
  expect(useGraphStore.getState().ui.workspace).toBe("math");
  expect(useGraphStore.getState().ui.axis2dPair).toBe("xy");
});
