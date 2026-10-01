import { Color, DoubleSide, Vector2, Vector3 } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { abs, distance, fract, fwidth, max, min, positionWorld, smoothstep, uniform } from "three/tsl";

/** TSL compiles this adaptive grid to WGSL on WebGPU and GLSL on the renderer's
 * compatibility backend. The same uniforms drive all three baseline planes. */
export function createGraphGridMaterial() {
  const uniforms = {
    uMinorStep: uniform(1), uMajorStep: uniform(1), uFadeDistance: uniform(100),
    uGridOffset: uniform(new Vector2()), uCameraPosition: uniform(new Vector3()),
    uMinorColor: uniform(new Color()), uMajorColor: uniform(new Color()), uPlaneMode: uniform(0, "int")
  };
  const { uMinorStep, uMajorStep, uFadeDistance, uGridOffset, uCameraPosition, uMinorColor, uMajorColor, uPlaneMode } = uniforms;
  const coordinate = uPlaneMode.equal(1).select(positionWorld.xy, uPlaneMode.equal(2).select(positionWorld.yz, positionWorld.xz));
  const camera = uPlaneMode.equal(1).select(uCameraPosition.xy, uPlaneMode.equal(2).select(uCameraPosition.yz, uCameraPosition.xz));
  const gridCoordinate = coordinate.sub(uGridOffset);
  const line = (step: typeof uMinorStep) => {
    const scaled = gridCoordinate.div(max(step, 0.0001));
    const grid = abs(fract(scaled.sub(0.5)).sub(0.5)).div(max(fwidth(scaled), 0.0001));
    return min(grid.x, grid.y).min(1).oneMinus();
  };
  const major = line(uMajorStep), minor = line(uMinorStep).mul(major.oneMinus());
  const fade = smoothstep(uFadeDistance.mul(0.12), uFadeDistance.mul(0.88), distance(coordinate, camera)).oneMinus();
  const material = new MeshBasicNodeMaterial({ depthWrite: false, side: DoubleSide, transparent: true, toneMapped: false });
  material.colorNode = uMinorColor.mul(minor).add(uMajorColor.mul(major));
  material.opacityNode = minor.mul(0.38).add(major.mul(0.82)).mul(fade);
  return { material, uniforms };
}
