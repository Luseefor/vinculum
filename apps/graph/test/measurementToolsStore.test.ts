import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore } from "@/store/graphStore";

describe("measurement tools store behavior", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("creates a pin measurement from add pin tool", () => {
    const store = useGraphStore.getState();
    store.setCanvas2dTool("addPin");
    store.setProbePinnedMath({ horizontal: 1, vertical: 2 });

    const pins = useGraphStore.getState().scene.measurements.filter((measurement) => measurement.kind === "pin");
    expect(pins).toHaveLength(1);
  });

  it("creates distance and angle measurements from sequential points", () => {
    const store = useGraphStore.getState();

    store.setCanvas2dTool("measureDistance");
    store.setProbePinnedMath({ horizontal: 0, vertical: 0 });
    expect(useGraphStore.getState().scene.measurements).toHaveLength(0);
    store.setProbePinnedMath({ horizontal: 3, vertical: 4 });
    expect(useGraphStore.getState().scene.measurements[0]?.kind).toBe("distance");

    store.setCanvas2dTool("measureAngle");
    store.setProbePinnedMath({ horizontal: 1, vertical: 0 });
    store.setProbePinnedMath({ horizontal: 0, vertical: 0 });
    expect(useGraphStore.getState().scene.measurements).toHaveLength(1);
    store.setProbePinnedMath({ horizontal: 0, vertical: 1 });
    expect(useGraphStore.getState().scene.measurements[1]?.kind).toBe("angle");
  });

  it("tracks measurement tool draft state transitions", () => {
    const store = useGraphStore.getState();
    store.setCanvas2dTool("measureDistance");
    store.setProbePinnedMath({ horizontal: 0, vertical: 0 });
    expect(useGraphStore.getState().ui.measurementDraft?.kind).toBe("distance");
    store.setCanvas2dTool("pan");
    expect(useGraphStore.getState().ui.measurementDraft).toBeNull();
  });

  it("does not mutate scene when preview update has no picked point", () => {
    const before = useGraphStore.getState().scene.measurements;
    useGraphStore.getState().setProbePinnedWorld(null);
    expect(useGraphStore.getState().scene.measurements).toBe(before);
  });
});
