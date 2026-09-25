import { Mesh, Vector2, type Object3D } from "three";
import { worldToMath3D } from "@/lib/math/coordinates";
import {
  setPickRaycaster,
  type PickWorldFromCanvasArgs
} from "./graphThreeEnginePickWorld";

// S21 analysis pick: raycasts the shared scene for the ARMED source object
// only. The first mesh hit decides: a hit on another object (or nothing)
// is ignored, never silently attributed (PART 7). Returns canonical math
// coordinates (worldToMath3D applied once at the input boundary). No
// snapping: the point must stay exactly on the surface for the residual
// validity check.
//
// Robustness: a small cross of sub-pixel sample rays (center first) feeds
// one nearest-hit decision. A single ray can thread mesh vertices exactly
// (common on symmetric views: canvas-center clicks along diagonal sight
// lines), where triangle boundary tests may miss every front face yet
// catch shared back vertices — recording an occluded point for a click on
// visible surface. Sampling neighbors makes the pick land on the visible
// front in those cases; ties resolve to the center ray (stable sort).

const SUB_PIXEL_SAMPLES: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];

const scratchNdc = new Vector2();

export function pickAnalysisSourcePoint(
  event: { clientX: number; clientY: number },
  args: PickWorldFromCanvasArgs,
  sourceId: string
): { x: number; y: number; z: number } | null {
  if (!setPickRaycaster(event, args)) {
    return null;
  }
  const rect = args.pickOverride?.rect ?? args.renderer.domElement.getBoundingClientRect();
  const stepX = 1 / Math.max(rect.width, 1);
  const stepY = 1 / Math.max(rect.height, 1);
  const baseX = args.ndc.x;
  const baseY = args.ndc.y;
  const activeCamera = args.pickOverride?.camera ?? args.camera;

  const meshes: Mesh[] = [];
  args.objectsRoot.traverse((child) => {
    // S26: invisible primitive pick proxies are selection helpers, never
    // analysis sources or occluders.
    if (child instanceof Mesh && (child.userData as { pickProxy?: unknown }).pickProxy !== true) {
      meshes.push(child);
    }
  });

  let best: { distance: number; point: { x: number; y: number; z: number } } | null = null;
  for (const [offsetX, offsetY] of SUB_PIXEL_SAMPLES) {
    scratchNdc.set(baseX + offsetX * stepX, baseY + offsetY * stepY);
    args.raycaster.setFromCamera(scratchNdc, activeCamera);
    const hits = args.raycaster.intersectObjects(meshes, false);
    for (const hit of hits) {
      const hitId = findVinculumId(hit.object);
      if (hitId === null) {
        continue;
      }
      // First identified hit per ray owns that ray: another object
      // occluding the source means "not on the source", not a pass-through.
      if (hitId !== sourceId) {
        break;
      }
      if (best === null || hit.distance < best.distance) {
        const math = worldToMath3D({ x: hit.point.x, y: hit.point.y, z: hit.point.z });
        if (Number.isFinite(math.x) && Number.isFinite(math.y) && Number.isFinite(math.z)) {
          best = { distance: hit.distance, point: math };
        }
      }
      break;
    }
  }
  return best?.point ?? null;
}

function findVinculumId(object: Object3D): string | null {
  let current: Object3D | null = object;
  while (current) {
    const id = (current.userData as { vinculumId?: unknown }).vinculumId;
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
    current = current.parent;
  }
  return null;
}
