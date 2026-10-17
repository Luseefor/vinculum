import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/lib/store/editorStore";
import { resolveGeometryPanes } from "@/lib/graph3d/graphThreeGeometryViews";

describe("Geometry Studio view selection", () => {
  beforeEach(() => useEditorStore.setState({ geometryLayout: "single", geometryView: "perspective", geometrySplitView: "xy" }));

  it("keeps the chosen ortho view visible when entering split", () => {
    useEditorStore.getState().setGeometryView("yz");
    useEditorStore.getState().setGeometryLayout("split");
    const state = useEditorStore.getState();
    expect(resolveGeometryPanes(state.geometryLayout, state.geometryView, state.geometrySplitView)).toEqual(["perspective", "yz"]);
  });

  it("selects a new split plane without losing the active view", () => {
    useEditorStore.getState().setGeometryLayout("split");
    useEditorStore.getState().setGeometryView("xz");
    expect(useEditorStore.getState().geometrySplitView).toBe("xz");
    useEditorStore.getState().setGeometrySplitView("yz");
    expect(useEditorStore.getState().geometryView).toBe("yz");
  });

  it("preserves an active perspective pane when changing the secondary view", () => {
    useEditorStore.getState().setGeometryLayout("split");
    useEditorStore.getState().setGeometrySplitView("xz");
    expect(useEditorStore.getState().geometryView).toBe("perspective");
  });
  it("repairs an old saved split selection that names an invisible plane", () => {
    const merge = useEditorStore.persist.getOptions().merge!;
    const state = merge({ geometryLayout: "split", geometryView: "yz", geometrySplitView: "xy" }, useEditorStore.getState());
    expect(state.geometryView).toBe("xy");
  });

});
