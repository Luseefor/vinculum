import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AddObjectMenu from "@/components/objects/AddObjectMenu";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { createObjectByKey } from "@/lib/objects/objectCreation";
import { getCurrentSceneSnapshot } from "@/lib/store/sceneStore";

describe("3D parametric creation", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useGraphStore.getState().setGraphMode("2d");
    useEditorStore.getState().setViewportMode("2d");
    useHistoryStore.getState().clear();
  });
  it.each(["parametricCurve","parametricSurface"])("creates %s in 3D from a 2D view with focus and undo", key => {
    useHistoryStore.getState().pushSnapshot(getCurrentSceneSnapshot());
    const id=createObjectByKey(key);
    expect(useGraphStore.getState().scene.objects.find(o => o.id===id)?.kind).toBe(key);
    expect(useGraphStore.getState().ui.graphMode).toBe("3d");
    expect(useEditorStore.getState().viewportMode).toBe("3d");
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(id);
    const snapshot=useHistoryStore.getState().undo(getCurrentSceneSnapshot());
    expect(snapshot).not.toBeNull();
    useGraphStore.getState().applySceneSnapshot(snapshot!);
    expect(useGraphStore.getState().scene.objects).toHaveLength(0);
  });
  it("finds parametric entries by 3D search and creates the surface", () => {
    render(<AddObjectMenu />);
    fireEvent.click(screen.getByRole("button",{name:"Open object menu"}));
    fireEvent.change(screen.getByLabelText("Search objects"),{target:{value:"3d parametric"}});
    expect(screen.getByRole("button",{name:"Parametric Curve"})).toBeVisible();
    fireEvent.click(screen.getByRole("button",{name:"Parametric Surface"}));
    expect(useGraphStore.getState().scene.objects[0]?.kind).toBe("parametricSurface");
    expect(useGraphStore.getState().ui.graphMode).toBe("3d");
  });
});

describe("explicit parametric dimensions", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useGraphStore.getState().setGraphMode("3d");
    useEditorStore.getState().setViewportMode("3d");
    useHistoryStore.getState().clear();
  });

  it.each(["parametricCurve", "parametricSurface"])("creates planar %s and reveals XY", kind => {
    const id = createObjectByKey(`${kind}-2d`);
    const store = useGraphStore.getState();
    expect(store.scene.objects.find(object => object.id === id)).toMatchObject({ kind, dimension: "2d", zExpr: "0" });
    expect(store.ui.graphMode).toBe("2d");
    expect(store.ui.axis2dPair).toBe("xy");
    expect(useEditorStore.getState().viewportMode).toBe("2d");
    expect(store.ui.selectedObjectId).toBe(id);
  });

  it.each(["parametricCurve", "parametricSurface"])("keeps %s planar when Enter creates the next object", kind => {
    const id = createObjectByKey(`${kind}-2d`);
    const next = useGraphStore.getState().insertObjectAfter(id, kind as "parametricCurve" | "parametricSurface");
    expect(useGraphStore.getState().scene.objects.find(object => object.id === next)).toMatchObject({ kind, dimension: "2d", zExpr: "0" });
  });

  it("offers both 2D parametric types in search", () => {
    render(<AddObjectMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Open object menu" }));
    fireEvent.change(screen.getByLabelText("Search objects"), { target: { value: "2d parametric" } });
    expect(screen.getByRole("button", { name: "2D Parametric Curve" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "2D Parametric Surface" }));
    expect(useGraphStore.getState().scene.objects[0]).toMatchObject({ kind: "parametricSurface", dimension: "2d" });
  });

  it.each(["parametricCurve", "parametricSurface"])("retains %s definitions across dimension changes and undo", kind => {
    const id = createObjectByKey(kind);
    const before = useGraphStore.getState().scene.objects[0];
    useHistoryStore.getState().pushSnapshot(getCurrentSceneSnapshot());
    useGraphStore.getState().setObjectKind(id, kind as "parametricCurve" | "parametricSurface", "2d");
    const planar = useGraphStore.getState().scene.objects[0];
    expect(planar).toMatchObject({ ...before, dimension: "2d", zExpr: "0", spatialZExpr: "zExpr" in before ? before.zExpr : "" });
    useGraphStore.getState().setObjectKind(id, kind as "parametricCurve" | "parametricSurface", "3d");
    expect(useGraphStore.getState().scene.objects[0]).toEqual({ ...before, dimension: "3d" });
    const snapshot = useHistoryStore.getState().undo(getCurrentSceneSnapshot());
    useGraphStore.getState().applySceneSnapshot(snapshot!);
    expect(useGraphStore.getState().scene.objects[0]).toEqual(before);
  });
});
