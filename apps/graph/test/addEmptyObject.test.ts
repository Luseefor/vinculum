import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore } from "@/store/graphStore";

describe("addEmptyObject", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("returns an id, selects the object, and stores an empty surface equation", () => {
    const id = useGraphStore.getState().addEmptyObject();
    const state = useGraphStore.getState();

    expect(id.length).toBeGreaterThan(0);
    expect(state.ui.selectedObjectId).toBe(id);

    const created = state.scene.objects.find((object) => object.id === id);
    expect(created?.kind).toBe("surface");
    if (created?.kind === "surface") {
      expect(created.equation).toBe("");
    }
  });

  it("setObjectKind from empty surface keeps expressions empty when converting to plane", () => {
    const id = useGraphStore.getState().addEmptyObject();
    useGraphStore.getState().setObjectKind(id, "plane");

    const updated = useGraphStore.getState().scene.objects.find((object) => object.id === id);
    expect(updated?.kind).toBe("plane");
    if (updated?.kind === "plane") {
      expect(updated.equation).toBe("");
    }
  });
});
