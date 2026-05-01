import { beforeEach, describe, expect, it, vi } from "vitest";

describe("editor constraints polish", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("creates constraints with default axis locks and offset", async () => {
    const { useEditorStore } = await import("@/lib/store/editorStore");
    useEditorStore.setState({ constraints: [] });
    useEditorStore.getState().addConstraint("offset", ["a", "b"]);

    const constraint = useEditorStore.getState().constraints[0];
    expect(constraint?.axisLocks).toEqual({ x: true, y: true, z: true });
    expect(constraint?.offsetValue).toBe(28);
  });

  it("updates axis locks and validates numeric offset input", async () => {
    const { useEditorStore } = await import("@/lib/store/editorStore");
    useEditorStore.setState({
      constraints: [
        {
          id: "c1",
          type: "offset",
          objectIds: ["a", "b"],
          enabled: true,
          axisLocks: { x: true, y: true, z: true },
          offsetValue: 28
        }
      ]
    });

    useEditorStore.getState().updateConstraintAxisLocks("c1", { y: false });
    expect(useEditorStore.getState().constraints[0]?.axisLocks).toEqual({ x: true, y: false, z: true });

    useEditorStore.getState().updateConstraintOffsetValue("c1", 999);
    expect(useEditorStore.getState().constraints[0]?.offsetValue).toBe(255);

    useEditorStore.getState().updateConstraintOffsetValue("c1", Number.NaN);
    expect(useEditorStore.getState().constraints[0]?.offsetValue).toBe(255);
  });

  it("normalizes legacy persisted constraints through persist merge", async () => {
    const { useEditorStore } = await import("@/lib/store/editorStore");
    const merge = useEditorStore.persist.getOptions().merge;
    const current = useEditorStore.getState();
    const merged = merge?.(
      {
        constraints: [
          {
            id: "legacy",
            type: "offset",
            objectIds: ["a", "b"],
            enabled: true
          }
        ]
      },
      current
    );

    const first = merged?.constraints?.[0];
    expect(first?.axisLocks).toEqual({ x: true, y: true, z: true });
    expect(first?.offsetValue).toBe(28);
  });
});
