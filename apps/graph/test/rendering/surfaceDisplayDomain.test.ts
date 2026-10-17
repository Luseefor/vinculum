import { beforeEach, expect, it } from "vitest";
import { surfaceDisplayDomain } from "@/lib/graph3d/surfaceDisplayDomain";
import { useGraphStore } from "@/store/graphStore";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { buildSurface } from "@/lib/graph3d/buildGraphSurface";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { SurfaceGraphObject } from "@vinculum/scene/types";
import { Mesh } from "three";

const view = { distance: 16, fov: 48, aspect: 1.5, target: { x: 0, y: 0, z: 0 } };
beforeEach(() => useGraphStore.getState().resetScene());
function surface(): SurfaceGraphObject {
  const id = useGraphStore.getState().commitAutoEquation("x=y^2+z^2").id!;
  return useGraphStore.getState().scene.objects.find((object) => object.id === id) as SurfaceGraphObject;
}
it("covers beyond the old edges and expands with zoom without modifying the scene", () => {
  const object = surface();
  const before = serializeScene(useGraphStore.getState().scene);
  const near = surfaceDisplayDomain(object, view);
  const far = surfaceDisplayDomain(object, { ...view, distance: 160 });
  expect(near.xMax).toBeGreaterThan(5);
  expect(far.xMax).toBeGreaterThan(near.xMax);
  expect(serializeScene(useGraphStore.getState().scene)).toBe(before);
});
it("keeps ordinary orbit frames on the same sampling tile and tracks the right mathematical input axes", () => {
  const object = surface();
  expect(surfaceDisplayDomain(object, { ...view, distance: 16.01 })).toEqual(surfaceDisplayDomain(object, view));
  const shifted = surfaceDisplayDomain(object, { ...view, target: { x: 999, y: 50, z: 100 } });
  expect((shifted.xMin + shifted.xMax) / 2).toBeCloseTo(104, -1);
  expect((shifted.yMin + shifted.yMax) / 2).toBeCloseTo(48, -1);
});
it("preserves custom ranges through edits and canonical save/load", () => {
  const object = surface();
  useGraphStore.getState().updateSurfaceDomain(object.id, { xMin: -2, xMax: 2 });
  useGraphStore.getState().commitAutoEquation("x=y^2+z^2+1", object.id);
  const updated = useGraphStore.getState().scene.objects[0] as SurfaceGraphObject;
  expect(updated.autoDomain).toBe(false);
  expect(surfaceDisplayDomain(updated, { ...view, distance: 1000 })).toBe(updated.domain);
  const restored = deserializeScene(serializeScene(useGraphStore.getState().scene));
  expect(restored.valid).toBe(true);
  expect(restored.normalizedScene?.objects[0]).toMatchObject({ autoDomain: false, domain: { xMin: -2, xMax: 2 } });
  useGraphStore.getState().setSurfaceAutoDomain(object.id, true);
  expect(surfaceDisplayDomain(useGraphStore.getState().scene.objects[0] as SurfaceGraphObject, view).xMax).toBeGreaterThan(2);
});
it("builds real extended surface vertices using the canonical Rust sampler", () => {
  const object = surface();
  const displayed = { ...object, domain: surfaceDisplayDomain(object, view) };
  const group = buildSurface(displayed, "light", getGraphThemeTokens("light"))!;
  let highest = 0;
  group.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const positions = node.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) highest = Math.max(highest, positions.getX(i));
  });
  expect(highest).toBeGreaterThan(50); // old ±5 range stopped at x=50
});
it("bounds pathological camera inputs and rejects malformed persisted settings", () => {
  const object = surface();
  const domain = surfaceDisplayDomain(object, { ...view, distance: 1e100 });
  expect(domain.xMax - domain.xMin).toBeLessThanOrEqual(32768);
  const scene = JSON.parse(serializeScene(useGraphStore.getState().scene));
  scene.objects[0].autoDomain = "yes";
  expect(deserializeScene(JSON.stringify(scene)).valid).toBe(false);
});
