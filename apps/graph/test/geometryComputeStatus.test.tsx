import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useGeometryComputeStore } from "@/lib/compute/geometryComputeStatus";
import ObjectRow from "@/components/objects/ObjectRow";
import type { ImplicitSurfaceObject } from "@vinculum/scene/types";

function makeImplicit(): ImplicitSurfaceObject {
  return {
    id: "implicit-1",
    kind: "implicitSurface",
    color: "#3b82f6",
    visible: true,
    equation: "x^2 + y^2 + z^2 = 1",
    domain: { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 },
    resolution: 16,
    appearance: { wireframe: false }
  };
}

describe("geometryComputeStatus store", () => {
  beforeEach(() => {
    useGeometryComputeStore.getState().clearAll();
  });

  it("starts idle for unknown objects", () => {
    expect(useGeometryComputeStore.getState().entries["nope"]).toBeUndefined();
  });

  it("sets, reads, and clears per-object status", () => {
    const store = useGeometryComputeStore.getState();
    store.setStatus("a", "pending");
    expect(useGeometryComputeStore.getState().entries["a"]?.status).toBe("pending");
    store.setStatus("a", "error", "bad math");
    expect(useGeometryComputeStore.getState().entries["a"]).toMatchObject({
      status: "error",
      message: "bad math"
    });
    store.clearStatus("a");
    expect(useGeometryComputeStore.getState().entries["a"]).toBeUndefined();
  });

  it("clearStatus on a missing id is a no-op returning the same state", () => {
    const before = useGeometryComputeStore.getState().entries;
    useGeometryComputeStore.getState().clearStatus("missing");
    expect(useGeometryComputeStore.getState().entries).toBe(before);
  });

  it("clearAll empties every entry", () => {
    const store = useGeometryComputeStore.getState();
    store.setStatus("a", "pending");
    store.setStatus("b", "error", "x");
    store.clearAll();
    expect(useGeometryComputeStore.getState().entries).toEqual({});
  });

  it("tracks objects independently", () => {
    const store = useGeometryComputeStore.getState();
    store.setStatus("a", "pending");
    store.setStatus("b", "error");
    store.clearStatus("a");
    expect(useGeometryComputeStore.getState().entries["a"]).toBeUndefined();
    expect(useGeometryComputeStore.getState().entries["b"]?.status).toBe("error");
  });
});

describe("ObjectRow compute indicator", () => {
  beforeEach(() => {
    useGeometryComputeStore.getState().clearAll();
  });

  function renderRow() {
    return render(
      <ObjectRow
        object={makeImplicit()}
        index={0}
        selected={false}
        onSelect={vi.fn()}
        onToggleVisibility={vi.fn()}
      />
    );
  }

  it("shows nothing while idle", () => {
    renderRow();
    expect(screen.queryByTestId("compute-status-pending")).toBeNull();
    expect(screen.queryByTestId("compute-status-error")).toBeNull();
  });

  it("shows a labelled pending dot while computing", () => {
    const { unmount } = renderRow();
    act(() => {
      useGeometryComputeStore.getState().setStatus("implicit-1", "pending");
    });
    const dot = screen.getByTestId("compute-status-pending");
    expect(dot).toHaveAttribute("aria-label", "Computing geometry");
    expect(dot.getAttribute("role")).toBe("img");
    unmount();
  });

  it("shows a labelled error dot on failure and clears with status", () => {
    const { unmount } = renderRow();
    act(() => {
      useGeometryComputeStore.getState().setStatus("implicit-1", "error", "bad math");
    });
    expect(screen.getByTestId("compute-status-error")).toHaveAttribute("aria-label", "Geometry compute failed");
    act(() => {
      useGeometryComputeStore.getState().clearStatus("implicit-1");
    });
    expect(screen.queryByTestId("compute-status-error")).toBeNull();
    unmount();
  });

  it("does not rerender unrelated rows (per-object subscription)", () => {
    const { container, unmount } = renderRow();
    const before = container.innerHTML;
    act(() => {
      useGeometryComputeStore.getState().setStatus("other-object", "pending");
    });
    expect(container.innerHTML).toBe(before);
    unmount();
  });
});
