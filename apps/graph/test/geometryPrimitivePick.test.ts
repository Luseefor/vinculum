import { describe, expect, it } from "vitest";
import { Group, PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import type { VectorObject } from "@vinculum/scene/types";
import { buildVectorPrimitive } from "@/lib/graph3d/buildGraphGeometryPrimitives";
import { pickGeometryPrimitiveAtPointer } from "@/lib/graph3d/graphThreePrimitivePick";

function vector(): VectorObject {
  return {
    id: "vec-1",
    kind: "vector",
    color: "#3b82f6",
    visible: true,
    oxExpr: "0",
    oyExpr: "0",
    ozExpr: "0",
    vxExpr: "2",
    vyExpr: "0",
    vzExpr: "0"
  };
}

function pickSetup() {
  const objectsRoot = new Group();
  const node = buildVectorPrimitive(vector());
  expect(node).not.toBeNull();
  objectsRoot.add(node!);
  objectsRoot.updateMatrixWorld(true);
  const camera = new PerspectiveCamera(48, 1, 0.1, 30000);
  camera.position.set(6, 6, 6);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const rect = { left: 0, top: 0, width: 800, height: 800 };
  const renderer = { domElement: { getBoundingClientRect: () => rect } };
  return { objectsRoot, camera, raycaster, ndc, renderer, rect };
}

function clientForWorld(point: Vector3, camera: PerspectiveCamera, rect: { width: number; height: number }) {
  const projected = point.clone().project(camera);
  return {
    clientX: ((projected.x + 1) / 2) * rect.width,
    clientY: ((-projected.y + 1) / 2) * rect.height
  };
}

describe("primitive picking (S26 PART 23/45)", () => {
  it("selects the vector through its proxy shaft", () => {
    const { objectsRoot, camera, raycaster, ndc, renderer } = pickSetup();
    // World midpoint of the shaft: math (1,0,0) -> world (1,0,0).
    const event = clientForWorld(new Vector3(1, 0, 0), camera, { width: 800, height: 800 });
    const id = pickGeometryPrimitiveAtPointer(event, {
      renderer: renderer as never,
      camera,
      raycaster,
      ndc,
      objectsRoot,
      baselinePlane: undefined as never,
      tempGround: new Vector3(),
      pickOverride: null
    });
    expect(id).toBe("vec-1");
  });

  it("misses empty space without touching selection", () => {
    const { objectsRoot, camera, raycaster, ndc, renderer } = pickSetup();
    const id = pickGeometryPrimitiveAtPointer(
      { clientX: 790, clientY: 790 },
      {
        renderer: renderer as never,
        camera,
        raycaster,
        ndc,
        objectsRoot,
        baselinePlane: undefined as never,
        tempGround: new Vector3(),
        pickOverride: null
      }
    );
    expect(id).toBeNull();
  });

  it("returns null with no primitives and rejects degenerate rects", () => {
    const { camera, raycaster, ndc, renderer } = pickSetup();
    const empty = new Group();
    expect(
      pickGeometryPrimitiveAtPointer(
        { clientX: 400, clientY: 400 },
        {
          renderer: renderer as never,
          camera,
          raycaster,
          ndc,
          objectsRoot: empty,
          baselinePlane: undefined as never,
          tempGround: new Vector3(),
          pickOverride: null
        }
      )
    ).toBeNull();
    const zeroRect = { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) } };
    expect(
      pickGeometryPrimitiveAtPointer(
        { clientX: 0, clientY: 0 },
        {
          renderer: zeroRect as never,
          camera,
          raycaster,
          ndc,
          objectsRoot: empty,
          baselinePlane: undefined as never,
          tempGround: new Vector3(),
          pickOverride: null
        }
      )
    ).toBeNull();
  });
});
