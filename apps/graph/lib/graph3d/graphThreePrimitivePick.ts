// S26 canvas selection for geometric primitives. Unlike derived S21–S24
// overlays, Vector/Line/Ray/Segment are real scene objects and must be
// selectable from the canvas (PART 23). Selection raycasts invisible pick
// proxies (plus visible point markers) only — never render meshes — so it
// cannot disturb probe or analysis picking. All child meshes map to the
// parent object id; shaft/head/endpoints are never independently
// selectable. Verified in Perspective and orthographic panes through the
// shared S16 pane-aware raycaster (no separate pick implementation).

import { Mesh, type Object3D } from "three";
import {
  setPickRaycaster,
  type PickWorldFromCanvasArgs
} from "./graphThreeEnginePickWorld";

function findPrimitiveId(object: Object3D): string | null {
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

export function pickGeometryPrimitiveAtPointer(
  event: { clientX: number; clientY: number },
  args: PickWorldFromCanvasArgs
): string | null {
  if (!setPickRaycaster(event, args)) {
    return null;
  }
  const proxies: Object3D[] = [];
  args.objectsRoot.traverse((child) => {
    const flags = child.userData as { pickProxy?: unknown; pointMarker?: unknown };
    if ((child instanceof Mesh && flags.pickProxy === true) || flags.pointMarker === true) {
      proxies.push(child);
    }
  });
  if (proxies.length === 0) {
    return null;
  }
  const hits = args.raycaster.intersectObjects(proxies, false);
  for (const hit of hits) {
    const id = findPrimitiveId(hit.object);
    if (id !== null) {
      return id;
    }
  }
  return null;
}
