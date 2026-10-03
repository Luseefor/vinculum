import { Easing } from "remotion";

/**
 * Clean linear / exponential easing functions for minimal, confident motion
 */
export const EASINGS = {
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  snap: Easing.bezier(0.05, 0.9, 0.1, 1),
  linear: Easing.linear,
};

/**
 * Tightened Pacing & Real Product Rendering Timeline (11.5s / 345 frames @ 30fps)
 *
 * 0.0s - 1.4s (frames 0 - 42): Hook ("Mathematics shouldn't feel flat.")
 * 1.4s - 2.3s (frames 42 - 69): Brand Punctuation ("VINCULUM / See equations with depth.")
 * 2.3s - 5.5s (frames 69 - 165): Real Editor with Cause-and-Effect interaction
 * 5.5s - 8.5s (frames 165 - 255): Real Parametric 3D View (Helix with real wide-stroke & axes)
 * 8.5s - 11.5s (frames 255 - 345): Real Differential Surface (Saddle with real MeshStandardMaterial & lighting)
 */
export const PROTOTYPE_TIMELINE = {
  fps: 30,
  durationInFrames: 345, // 11.5 seconds
  shots: {
    hook: { start: 0, end: 42 },
    brand: { start: 42, end: 69 },
    editor: { start: 69, end: 165 },
    parametric: { start: 165, end: 255 },
    surfaces: { start: 255, end: 345 },
  },
};
