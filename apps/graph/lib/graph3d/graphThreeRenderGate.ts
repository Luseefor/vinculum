/** Keep polling editor/worker state, but submit GPU work only for visual changes. */
export function createGraphThreeRenderGate() {
  let invalidated = true;
  let previous: readonly unknown[] = [];
  return {
    invalidate: () => { invalidated = true; },
    shouldRender: (dependencies: readonly unknown[]) => {
      const changed = invalidated || dependencies.length !== previous.length ||
        dependencies.some((value, index) => !Object.is(value, previous[index]));
      invalidated = false;
      previous = dependencies;
      return changed;
    }
  };
}

/** Reduce fragment work only while slow navigation is active. Geometry and
 * numerical samples stay intact; resting frames and captures use full DPR. */
export function createGraphThreeRenderResolution() {
  let lastInteractionAt = -Infinity;
  let scale = 1;
  let slowFrames = 0;
  return {
    markInteraction: (nowMs: number) => { lastInteractionAt = nowMs; },
    fullResolution: (devicePixelRatio: number) => {
      scale = 1;
      slowFrames = 0;
      return Math.min(devicePixelRatio, 2);
    },
    pixelRatio: (nowMs: number, frameDeltaMs: number, previousFrameRendered: boolean, devicePixelRatio: number) => {
      // A slow draw can itself exceed the usual wheel debounce. Keep one
      // reduced target across the gesture instead of reallocating every frame.
      if (nowMs - lastInteractionAt > 1000) {
        scale = 1;
        slowFrames = 0;
      } else if (previousFrameRendered) {
        slowFrames = frameDeltaMs > 40 ? slowFrames + 1 : 0;
        if (slowFrames >= 2 || frameDeltaMs >= 100) {
          scale = Math.max(0.25, scale * 0.5);
          slowFrames = 0;
        }
      }
      return Math.min(devicePixelRatio, 2) * scale;
    }
  };
}
