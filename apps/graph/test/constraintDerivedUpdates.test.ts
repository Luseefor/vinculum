import { describe, expect, it, vi } from "vitest";
import { applyConstraintDerivedUpdates } from "@/lib/editor/applyConstraintDerivedUpdates";
import { useGraphStore } from "@/store/graphStore";
import type { EditorConstraint } from "@/lib/store/editorStore";

function createConstraint(partial: Partial<EditorConstraint>): EditorConstraint {
  return {
    id: "c_test",
    type: "offset",
    objectIds: ["src", "dst"],
    enabled: true,
    axisLocks: { x: true, y: true, z: true },
    offsetValue: 28,
    ...partial
  };
}

describe("applyConstraintDerivedUpdates", () => {
  it("applies axis-locked offset color updates", () => {
    useGraphStore.getState().resetScene();
    const sourceId = useGraphStore.getState().addEmptyObject();
    const targetId = useGraphStore.getState().addPlaneObject();
    useGraphStore.getState().updateObjectColor(sourceId, "#102030");

    const setVisibility = vi.fn();
    const setColor = vi.fn();
    const result = applyConstraintDerivedUpdates(
      [
        createConstraint({
          objectIds: [sourceId, targetId],
          axisLocks: { x: true, y: false, z: true },
          offsetValue: 10
        })
      ],
      setVisibility,
      setColor
    );

    expect(result.updateCount).toBe(1);
    expect(result.errors).toEqual([]);
    expect(setColor).toHaveBeenCalledWith(targetId, "#1a203a");
  });

  it("reports invalid offset and missing reference errors without mutating", () => {
    useGraphStore.getState().resetScene();
    const sourceId = useGraphStore.getState().addEmptyObject();
    const targetId = useGraphStore.getState().addPlaneObject();

    const setVisibility = vi.fn();
    const setColor = vi.fn();
    const result = applyConstraintDerivedUpdates(
      [
        createConstraint({
          id: "bad-offset",
          objectIds: [sourceId, targetId],
          offsetValue: Number.NaN
        }),
        createConstraint({
          id: "bad-axis",
          objectIds: [sourceId, "missing-target-2"],
          axisLocks: { x: true, y: true, z: true }
        })
      ],
      setVisibility,
      setColor
    );

    expect(result.updateCount).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(setVisibility).not.toHaveBeenCalled();
    expect(setColor).not.toHaveBeenCalled();
  });
});
