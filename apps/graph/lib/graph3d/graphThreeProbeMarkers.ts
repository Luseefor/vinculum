import { Group, Mesh, MeshBasicMaterial, SphereGeometry } from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

export type ProbePin = { id: string; color: string; world: { x: number; y: number; z: number } };

export function updateThreeProbeMarkers(
  pins: ProbePin[],
  probeMarkersRoot: Group,
  probeMarkerMeshes: Mesh[],
  probeMarkerLabels: CSS2DObject[]
): void {
  while (probeMarkerMeshes.length < pins.length) {
    const mesh = new Mesh(
      new SphereGeometry(0.08, 10, 10),
      new MeshBasicMaterial({ color: "#f472b6", transparent: true, opacity: 0.95 })
    );
    probeMarkerMeshes.push(mesh);
    probeMarkersRoot.add(mesh);

    const label = document.createElement("div");
    label.style.pointerEvents = "none";
    label.style.whiteSpace = "nowrap";
    label.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
    label.style.fontSize = "10px";
    label.style.padding = "2px 6px";
    label.style.borderRadius = "6px";
    label.style.border = "1px solid rgba(148,163,184,0.35)";
    label.style.background = "rgba(15,23,42,0.78)";
    label.style.color = "#e2e8f0";
    label.style.boxShadow = "0 6px 18px rgba(0,0,0,0.18)";
    const labelObj = new CSS2DObject(label);
    probeMarkerLabels.push(labelObj);
    probeMarkersRoot.add(labelObj);
  }
  while (probeMarkerMeshes.length > pins.length) {
    const mesh = probeMarkerMeshes.pop();
    if (mesh) {
      probeMarkersRoot.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
    const label = probeMarkerLabels.pop();
    if (label) {
      probeMarkersRoot.remove(label);
      (label.element as HTMLElement).remove();
    }
  }

  for (let i = 0; i < pins.length; i++) {
    const pin = pins[i];
    probeMarkerMeshes[i].position.set(pin.world.x, pin.world.y, pin.world.z);
    (probeMarkerMeshes[i].material as MeshBasicMaterial).color.set(pin.color);
    probeMarkerMeshes[i].userData.probePinId = pin.id;
    probeMarkerMeshes[i].visible = true;

    const labelObj = probeMarkerLabels[i];
    labelObj.position.set(pin.world.x, pin.world.y + 0.14, pin.world.z);
    const el = labelObj.element as HTMLElement;
    el.textContent = `X ${pin.world.x.toFixed(4)} · Y ${pin.world.y.toFixed(4)} · Z ${pin.world.z.toFixed(4)}`;
    labelObj.visible = true;
  }
}
