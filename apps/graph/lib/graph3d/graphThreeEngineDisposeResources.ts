import type { BufferGeometry, LineSegments, Object3D, Scene } from "three";
import { LineBasicMaterial, Mesh, MeshBasicMaterial } from "three";
import type { Group } from "three";
import type { ShaderMaterial } from "three";
import type { WebGLRenderer } from "three";
import type { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { disposeObject3D } from "@/lib/graph3d/buildGraphObjects";

export type DisposeGraphThreeEngineResourcesArgs = {
  scene: Scene;
  objectsRoot: Group;
  objectNodes: Map<string, Object3D>;
  objectSignatures: Map<string, string>;
  objectStructureSignatures: Map<string, string>;
  sketchGeometry: BufferGeometry;
  sketchMaterial: LineBasicMaterial;
  probeMarkersRoot: Group;
  probeMarkerMeshes: Mesh[];
  probeMarkerLabels: CSS2DObject[];
  hoverMarker: Mesh;
  gridMesh: Mesh;
  gridMaterial: ShaderMaterial;
  axisLineGeometry: BufferGeometry | null;
  axisLineSegments: LineSegments | null;
  axisTubeGroup: Group | null;
  originMesh: Mesh;
  labelX: HTMLElement;
  labelY: HTMLElement;
  labelZ: HTMLElement;
  perfBadge: HTMLDivElement;
  probeBadge: HTMLDivElement;
  hoverProbeBadge: HTMLDivElement;
  renderer: WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  container: HTMLElement;
};

export function disposeGraphThreeEngineThreeResources(args: DisposeGraphThreeEngineResourcesArgs): void {
  const {
    scene,
    objectsRoot,
    objectNodes,
    objectSignatures,
    objectStructureSignatures,
    sketchGeometry,
    sketchMaterial,
    probeMarkersRoot,
    probeMarkerMeshes,
    probeMarkerLabels,
    hoverMarker,
    gridMesh,
    gridMaterial,
    axisLineGeometry,
    axisLineSegments,
    axisTubeGroup,
    originMesh,
    labelX,
    labelY,
    labelZ,
    perfBadge,
    probeBadge,
    hoverProbeBadge,
    renderer,
    labelRenderer,
    container
  } = args;

  while (objectsRoot.children.length > 0) {
    const child = objectsRoot.children[0];
    objectsRoot.remove(child);
    disposeObject3D(child);
  }
  objectNodes.clear();
  objectSignatures.clear();
  objectStructureSignatures.clear();

  scene.remove(objectsRoot);
  sketchGeometry.dispose();
  sketchMaterial.dispose();

  while (probeMarkerMeshes.length > 0) {
    const mesh = probeMarkerMeshes.pop();
    if (mesh) {
      probeMarkersRoot.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
  }
  while (probeMarkerLabels.length > 0) {
    const label = probeMarkerLabels.pop();
    if (label) {
      probeMarkersRoot.remove(label);
      (label.element as HTMLElement).remove();
    }
  }
  scene.remove(probeMarkersRoot);

  hoverMarker.geometry.dispose();
  (hoverMarker.material as MeshBasicMaterial).dispose();
  scene.remove(hoverMarker);

  gridMesh.geometry.dispose();
  gridMaterial.dispose();
  if (axisLineGeometry) {
    axisLineGeometry.dispose();
  }
  if (axisLineSegments) {
    axisLineSegments.geometry.dispose();
    (axisLineSegments.material as LineBasicMaterial).dispose();
  }
  if (axisTubeGroup) {
    axisTubeGroup.traverse((child) => {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat.dispose();
        }
      }
    });
  }
  originMesh.geometry.dispose();
  (originMesh.material as MeshBasicMaterial).dispose();
  labelX.remove();
  labelY.remove();
  labelZ.remove();
  perfBadge.remove();
  probeBadge.remove();
  hoverProbeBadge.remove();

  renderer.dispose();
  if (renderer.domElement.parentElement === container) {
    container.removeChild(renderer.domElement);
  }
  if (labelRenderer.domElement.parentElement === container) {
    container.removeChild(labelRenderer.domElement);
  }
}
