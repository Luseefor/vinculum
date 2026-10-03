import { expect, it } from "vitest";
import { Mesh, type BufferGeometry } from "three";
import { buildImplicitCurve } from "@/lib/graph3d/buildGraphImplicitCurve";
import { buildIndexedSurfaceMeshGroup } from "@/lib/graph3d/buildIndexedSurfaceMesh";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { disposeObject3D } from "@/lib/graph3d/buildGraphObjectDisposal";

it.each(["x=2", "x=y^2", "x^2+y^2=4"])("renders %s as a thick curve on the XY plane", equation => {
  const stroke = buildImplicitCurve({ kind: "implicitCurve", id: "curve", equation, color: "#3b82f6", visible: true })!;
  expect(stroke).not.toBeNull();
  expect(stroke.userData.wideStroke).toBe(true);
  const positions = (stroke.geometry as BufferGeometry).userData.strokePositions as Float32Array;
  expect(positions.length).toBeGreaterThan(6);
  for (let index = 0; index < positions.length; index += 3) {
    expect(positions[index + 1]).toBe(0); // math z=0 maps to world y=0
    if (equation === "x=2") expect(positions[index]).toBeCloseTo(2, 5);
    if (equation === "x=y^2") expect(positions[index]).toBeCloseTo(positions[index + 2] ** 2, 2);
    if (equation === "x^2+y^2=4") expect(positions[index] ** 2 + positions[index + 2] ** 2).toBeCloseTo(4, 2);
  }
  disposeObject3D(stroke);
});

it("welds implicit surface normals and leaves filled surfaces free of triangle overlays", () => {
  const group = buildIndexedSurfaceMeshGroup({ id: "surface", color: "#3b82f6", wireframe: false, theme: "light", tokens: getGraphThemeTokens("light"), smoothNormals: true,
    positions: new Float32Array([0,0,0, 1,0,0, 0,1,0, 1,0,0, 1,1,0, 0,1,0]), indices: new Uint16Array([0,1,2,3,4,5]) })!;
  expect(group.children).toHaveLength(1);
  const mesh = group.children[0] as Mesh;
  expect(mesh.geometry.getAttribute("position").count).toBe(4);
  expect(mesh.geometry.getAttribute("normal").count).toBe(4);
  expect(mesh.geometry.getIndex()?.count).toBe(6);
  disposeObject3D(group);
});


it("uses bounded 1D strokes for explicit graphs instead of a dense contour grid", () => {
  const stroke = buildImplicitCurve({ kind: "implicitCurve", id: "explicit", equation: "y=sin(20*x)", color: "#3b82f6", visible: true })!;
  const positions = (stroke.geometry as BufferGeometry).userData.strokePositions as Float32Array;
  expect(positions.length).toBeLessThanOrEqual(2048*6);
  for (let index=0; index<positions.length; index+=3) expect(positions[index+2]).toBeCloseTo(Math.sin(20*positions[index]),3);
  disposeObject3D(stroke);
});
