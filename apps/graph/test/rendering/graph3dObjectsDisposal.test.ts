import { describe, expect, it, vi } from "vitest";
import { Group, Line, LineBasicMaterial, BufferGeometry, Mesh, MeshBasicMaterial } from "three";
import { applyObjectColorToNode, disposeObject3D } from "@/lib/graph3d/buildGraphObjects";

describe("graph3d disposal and color mutation", () => {
  it("disposes geometry and material during object disposal", () => {
    const geometry = new BufferGeometry();
    const material = new MeshBasicMaterial({ color: "#ff0000" });
    const mesh = new Mesh(geometry, material);
    const root = new Group();
    root.add(mesh);

    const geometryDisposeSpy = vi.spyOn(geometry, "dispose");
    const materialDisposeSpy = vi.spyOn(material, "dispose");

    disposeObject3D(root);

    expect(geometryDisposeSpy).toHaveBeenCalledTimes(1);
    expect(materialDisposeSpy).toHaveBeenCalledTimes(1);
  });

  it("mutates mesh and line material colors in-place", () => {
    const root = new Group();
    const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial({ color: "#ff0000" }));
    const line = new Line(new BufferGeometry(), new LineBasicMaterial({ color: "#ff0000" }));
    root.add(mesh, line);

    applyObjectColorToNode(root, "#22c55e");

    expect((mesh.material as MeshBasicMaterial).color.getHexString()).toBe("22c55e");
    expect((line.material as LineBasicMaterial).color.getHexString()).toBe("22c55e");
  });
});
