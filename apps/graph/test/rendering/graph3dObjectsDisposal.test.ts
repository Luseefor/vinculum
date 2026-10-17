import { describe, expect, it, vi } from "vitest";
import { DataTexture, Scene, Group, Line, LineBasicMaterial, BufferGeometry, Mesh, MeshBasicMaterial } from "three";
import { disposeGraphThreeEngineThreeResources } from "@/lib/graph3d/graphThreeEngineDisposeResources";
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


it("releases owned scalar textures when the entire 3D viewport is disposed", () => {
  const texture = new DataTexture(new Uint8Array(16), 2, 2);
  const geometry = new BufferGeometry();
  const material = new MeshBasicMaterial({ map: texture });
  const overlay = new Group();
  overlay.add(new Mesh(geometry, material));
  const overlayRoot = new Group();
  overlayRoot.add(overlay);
  const cache = new Map([["scalar-surface:source", { key: "sample", group: overlay }]]);
  const textureDispose = vi.spyOn(texture, "dispose");
  const geometryDispose = vi.spyOn(geometry, "dispose");
  const materialDispose = vi.spyOn(material, "dispose");
  const dom = () => document.createElement("div");
  disposeGraphThreeEngineThreeResources({
    scene: new Scene(), objectsRoot: new Group(), objectNodes: new Map(),
    objectSignatures: new Map(), objectStructureSignatures: new Map(),
    sketchGeometry: new BufferGeometry(), sketchMaterial: new LineBasicMaterial(),
    probeMarkersRoot: new Group(), probeMarkerMeshes: [], probeMarkerLabels: [],
    measurementMarkersRoot: new Group(), measurementLines: [], measurementLabels: [],
    analysisOverlayRoot: overlayRoot, analysisOverlayCache: cache, interactionRoot: new Group(),
    hoverMarker: new Mesh(new BufferGeometry(), new MeshBasicMaterial()),
    gridMesh: new Mesh(), gridMaterial: new MeshBasicMaterial(), axisLineGeometry: null,
    axisLineSegments: null, axisTubeGroup: null,
    originMesh: new Mesh(new BufferGeometry(), new MeshBasicMaterial()),
    labelX: dom(), labelY: dom(), labelZ: dom(), perfBadge: dom(), warningBadge: dom(),
    probeBadge: dom(), hoverProbeBadge: dom(), container: dom(),
    renderer: { dispose: vi.fn(), domElement: dom() } as unknown as Parameters<typeof disposeGraphThreeEngineThreeResources>[0]["renderer"],
    labelRenderer: { domElement: dom() } as unknown as Parameters<typeof disposeGraphThreeEngineThreeResources>[0]["labelRenderer"]
  });
  expect(textureDispose).toHaveBeenCalledOnce();
  expect(geometryDispose).toHaveBeenCalledOnce();
  expect(materialDispose).toHaveBeenCalledOnce();
  expect(cache.size).toBe(0);
  expect(overlayRoot.children).toHaveLength(0);
});
