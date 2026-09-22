import { describe, it, expect } from "vitest";
import { DirectionalLight, Group, Mesh, type Object3D, type WebGLRenderer } from "three";
import type { GraphObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { syncThreeSceneObjects } from "@/lib/graph3d/graphThreeSyncSceneObjects";

// S1-U7: camera/rebuild analysis (diagnostic-only, characterization).
// Exercises the headless object-sync path (no GL context needed) to pin down
// exactly which scene edits rebuild geometry and which apply in place.
// Camera orbit/pan/zoom/resize never reach this path: the RAF tick only calls
// syncObjects when objectsDirty is set (scene ref, parameter signature, theme,
// or context-restore), and resize() only adjusts camera aspect + renderer size.

function makeSurface(overrides: Partial<SurfaceGraphObject> = {}): SurfaceGraphObject {
  return {
    id: "surface-1",
    kind: "surface",
    color: "#3b82f6",
    visible: true,
    equation: "sin(x) * cos(y)",
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    resolution: 24,
    appearance: { wireframe: false },
    orientation: "z",
    ...overrides
  };
}

interface SyncHarness {
  root: Group;
  nodes: Map<string, Object3D>;
  signatures: Map<string, string>;
  structures: Map<string, string>;
  keyLight: DirectionalLight;
  renderer: WebGLRenderer;
  sync: (objects: GraphObject[]) => void;
}

function createHarness(): SyncHarness {
  const harness: SyncHarness = {
    root: new Group(),
    nodes: new Map(),
    signatures: new Map(),
    structures: new Map(),
    keyLight: new DirectionalLight(),
    renderer: { shadowMap: {} } as unknown as WebGLRenderer,
    sync: (objects: GraphObject[]) => {
      syncThreeSceneObjects(
        "dark",
        objects,
        harness.root,
        harness.nodes,
        harness.signatures,
        harness.structures,
        harness.keyLight,
        harness.renderer
      );
    }
  };
  return harness;
}

function meshColorHex(node: Object3D): string | null {
  let found: string | null = null;
  node.traverse((child) => {
    if (found === null && child instanceof Mesh) {
      const material = child.material as { color?: { getHexString?: () => string } };
      const hex = material.color?.getHexString?.();
      if (typeof hex === "string") {
        found = hex;
      }
    }
  });
  return found;
}

describe("3d sync rebuild triggers", () => {
  it("does not rebuild or replace nodes when nothing changed", () => {
    const harness = createHarness();
    const objects = [makeSurface()];
    harness.sync(objects);
    const node = harness.nodes.get("surface-1");
    expect(node).toBeDefined();
    const signature = harness.signatures.get("surface-1");

    harness.sync([makeSurface()]);
    expect(harness.nodes.get("surface-1")).toBe(node);
    expect(harness.signatures.get("surface-1")).toBe(signature);
    expect(harness.root.children.length).toBe(1);
  });

  it("reuses the cached node on visibility toggle without rebuilding (S7 F6 regression)", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    const node = harness.nodes.get("surface-1");
    expect(node?.visible).toBe(true);

    harness.sync([makeSurface({ visible: false })]);
    const hiddenNode = harness.nodes.get("surface-1");
    expect(hiddenNode).toBeDefined();
    expect(hiddenNode).toBe(node);
    expect(hiddenNode?.visible).toBe(false);
    expect(harness.root.children.length).toBe(1);

    harness.sync([makeSurface({ visible: true })]);
    const shownNode = harness.nodes.get("surface-1");
    expect(shownNode).toBe(node);
    expect(shownNode?.visible).toBe(true);
    expect(harness.root.children.length).toBe(1);
  });

  it("applies color changes in place without rebuilding", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    const node = harness.nodes.get("surface-1");

    harness.sync([makeSurface({ color: "#ff0000" })]);
    expect(harness.nodes.get("surface-1")).toBe(node);
    expect(meshColorHex(node as Object3D)).toBe("ff0000");
  });

  it("replaces the node and detaches the old one when the equation changes", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    const oldNode = harness.nodes.get("surface-1");

    harness.sync([makeSurface({ equation: "x^2 + y^2" })]);
    const nextNode = harness.nodes.get("surface-1");
    expect(nextNode).toBeDefined();
    expect(nextNode).not.toBe(oldNode);
    expect(oldNode?.parent).toBeNull();
    expect(harness.root.children.length).toBe(1);
  });

  it("removes nodes and signatures for deleted objects", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    expect(harness.nodes.size).toBe(1);

    harness.sync([]);
    expect(harness.nodes.size).toBe(0);
    expect(harness.signatures.size).toBe(0);
    expect(harness.structures.size).toBe(0);
    expect(harness.root.children.length).toBe(0);
  });
});
