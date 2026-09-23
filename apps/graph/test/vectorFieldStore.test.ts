import { beforeEach, describe, expect, it } from "vitest";
import { createVectorFieldGraph } from "@/lib/graph/createVectorFieldGraph";
import { updateVectorFieldField } from "@/store/graphStoreVectorFieldField";
import { useGraphStore } from "@/store/graphStore";

describe("vector field store (S20 Slice 6a)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("creates dimension-fixed fields with radial defaults", () => {
    const field2D = createVectorFieldGraph({ dimension: "2d" });
    expect(field2D.dimension).toBe("2d");
    expect(field2D.pExpr).toBe("x");
    expect(field2D.qExpr).toBe("y");
    expect(field2D.rExpr).toBe("");

    const field3D = createVectorFieldGraph({ dimension: "3d" });
    expect(field3D.dimension).toBe("3d");
    expect(field3D.rExpr).toBe("z");
  });

  it("addVectorFieldObject appends and selects the new field", () => {
    const id = useGraphStore.getState().addVectorFieldObject("3d");
    const objects = useGraphStore.getState().scene.objects;
    expect(objects).toHaveLength(1);
    const object = objects[0];
    expect(object?.kind).toBe("vectorField");
    if (object?.kind === "vectorField") {
      expect(object.dimension).toBe("3d");
    }
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(id);
  });

  it("updateVectorFieldField commits components, domain, density, scale, normalize", () => {
    const id = useGraphStore.getState().addVectorFieldObject("3d");
    const store = useGraphStore.getState();
    store.updateVectorFieldExpression(id, "pExpr", "-y");
    store.updateVectorFieldExpression(id, "xMin", -4);
    store.updateVectorFieldExpression(id, "density", 6);
    store.updateVectorFieldExpression(id, "scale", 2);
    store.updateVectorFieldExpression(id, "normalize", true);
    const object = useGraphStore.getState().scene.objects[0];
    expect(object).toMatchObject({ pExpr: "-y", density: 6, scale: 2, normalize: true });
    if (object?.kind === "vectorField" && object.dimension === "3d") {
      expect(object.domain.xMin).toBe(-4);
    }
  });

  it("updateVectorFieldField clamps density/scale and rejects bad values", () => {
    const object = createVectorFieldGraph({ dimension: "3d" });
    expect(updateVectorFieldField(object, "density", 99)?.density).toBe(12);
    expect(updateVectorFieldField(object, "scale", 99)?.scale).toBe(3);
    expect(updateVectorFieldField(object, "density", Number.NaN)).toBeNull();
    expect(updateVectorFieldField(object, "xMin", "abc")).toBeNull();
    expect(updateVectorFieldField(object, "normalize", "yes")).toBeNull();
  });

  it("2D fields reject z-domain and R writes", () => {
    const object = createVectorFieldGraph({ dimension: "2d" });
    expect(updateVectorFieldField(object, "zMin", 0)).toBeNull();
    expect(updateVectorFieldField(object, "rExpr", "z")).toBeNull();
    const updated = updateVectorFieldField(object, "pExpr", "-y");
    expect(updated).toMatchObject({ pExpr: "-y", dimension: "2d" });
  });

  it("setObjectKind converts with dimension preserved or defaulted", () => {
    const store = useGraphStore.getState();
    const surfaceId = store.addSurfaceObject();
    store.setObjectKind(surfaceId, "vectorField", "3d");
    let object = useGraphStore.getState().scene.objects.find((o) => o.id === surfaceId);
    expect(object?.kind).toBe("vectorField");
    if (object?.kind === "vectorField") {
      expect(object.dimension).toBe("3d");
    }

    // Vector -> vector without explicit dimension preserves it.
    store.setObjectKind(surfaceId, "vectorField");
    object = useGraphStore.getState().scene.objects.find((o) => o.id === surfaceId);
    if (object?.kind === "vectorField") {
      expect(object.dimension).toBe("3d");
    }
  });

  it("insertObjectAfter preserves the source field dimension (Enter-next)", () => {
    const store = useGraphStore.getState();
    const id = store.addVectorFieldObject("3d");
    const nextId = store.insertObjectAfter(id, "vectorField", "3d");
    const next = useGraphStore.getState().scene.objects.find((o) => o.id === nextId);
    expect(next?.kind).toBe("vectorField");
    if (next?.kind === "vectorField") {
      expect(next.dimension).toBe("3d");
    }
  });

  it("updateVectorFieldField ignores other kinds", () => {
    const store = useGraphStore.getState();
    const surfaceId = store.addSurfaceObject();
    const before = useGraphStore.getState().scene.objects.find((o) => o.id === surfaceId);
    store.updateVectorFieldExpression(surfaceId, "pExpr", "x");
    const after = useGraphStore.getState().scene.objects.find((o) => o.id === surfaceId);
    expect(after).toBe(before);
  });
});
