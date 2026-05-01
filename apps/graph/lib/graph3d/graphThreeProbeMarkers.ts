import { BufferGeometry, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { SceneMeasurement } from "@/lib/scene/sceneSchema";
import { formatMeasurementValue } from "@/lib/measurements/measurementMath";

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
    label.style.padding = "3px 8px";
    label.style.borderRadius = "5px";
    label.style.border = "1px solid rgba(148,163,184,0.35)";
    label.style.background = "rgba(15,23,42,0.92)";
    label.style.color = "#f8fafc";
    label.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
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

export function updateThreeMeasurementMarkers(
  measurements: SceneMeasurement[],
  selectedMeasurementId: string | null,
  measurementRoot: Group,
  measurementLines: Line[],
  measurementLabels: CSS2DObject[]
): void {
  const nonPin = measurements.filter((measurement) => measurement.kind !== "pin");
  while (measurementLines.length < nonPin.length) {
    const line = new Line(
      new BufferGeometry(),
      new LineBasicMaterial({ color: "#fb923c", transparent: true, opacity: 0.95 })
    );
    measurementLines.push(line);
    measurementRoot.add(line);

    const label = document.createElement("div");
    label.style.pointerEvents = "none";
    label.style.whiteSpace = "nowrap";
    label.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
    label.style.fontSize = "10px";
    label.style.padding = "3px 8px";
    label.style.borderRadius = "5px";
    label.style.border = "1px solid rgba(251,146,60,0.45)";
    label.style.background = "rgba(15,23,42,0.92)";
    label.style.color = "#f8fafc";
    label.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    const labelObj = new CSS2DObject(label);
    measurementLabels.push(labelObj);
    measurementRoot.add(labelObj);
  }
  while (measurementLines.length > nonPin.length) {
    const line = measurementLines.pop();
    if (line) {
      measurementRoot.remove(line);
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
    }
    const label = measurementLabels.pop();
    if (label) {
      measurementRoot.remove(label);
      (label.element as HTMLElement).remove();
    }
  }

  for (let i = 0; i < nonPin.length; i += 1) {
    const measurement = nonPin[i];
    const line = measurementLines[i];
    const material = line.material as LineBasicMaterial;
    const isSelected = measurement.id === selectedMeasurementId;
    material.color.set(isSelected ? "#f97316" : "#fb923c");
    material.linewidth = isSelected ? 2 : 1;
    if (measurement.kind === "distance") {
      line.geometry.setFromPoints([
        new Vector3(measurement.points[0].x, measurement.points[0].y, measurement.points[0].z),
        new Vector3(measurement.points[1].x, measurement.points[1].y, measurement.points[1].z)
      ]);
      measurementLabels[i].position.set(
        (measurement.points[0].x + measurement.points[1].x) / 2,
        (measurement.points[0].y + measurement.points[1].y) / 2 + 0.14,
        (measurement.points[0].z + measurement.points[1].z) / 2
      );
    } else {
      line.geometry.setFromPoints([
        new Vector3(measurement.points[0].x, measurement.points[0].y, measurement.points[0].z),
        new Vector3(measurement.points[1].x, measurement.points[1].y, measurement.points[1].z),
        new Vector3(measurement.points[2].x, measurement.points[2].y, measurement.points[2].z)
      ]);
      measurementLabels[i].position.set(
        measurement.points[1].x,
        measurement.points[1].y + 0.16,
        measurement.points[1].z
      );
    }
    (measurementLabels[i].element as HTMLElement).textContent = `${measurement.kind === "distance" ? "Distance" : "Angle"} ${formatMeasurementValue(measurement)}`;
    line.visible = true;
    measurementLabels[i].visible = true;
  }
}
