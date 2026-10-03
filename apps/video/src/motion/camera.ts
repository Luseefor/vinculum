import { interpolate, Easing } from "remotion";

/**
 * Standardized Easing Curves
 * Engineered specifically for mathematical / technical motion design
 */
export const EASINGS = {
  // Smooth, high-inertia camera travel (rapid start, long elegant settle)
  camera: Easing.bezier(0.16, 1, 0.3, 1),
  // Snappy interaction and parameter changes
  snap: Easing.bezier(0.05, 0.9, 0.1, 1),
  // Smooth deceleration for UI entrances
  decel: Easing.bezier(0, 0, 0.2, 1),
  // Gentle mathematical harmonic oscillation
  harmonic: Easing.bezier(0.42, 0, 0.58, 1),
};

export const SPRING_PRESETS = {
  snappy: { damping: 18, stiffness: 140, mass: 0.8 },
  gentle: { damping: 24, stiffness: 90, mass: 1.2 },
  settle: { damping: 20, stiffness: 110, mass: 1.0 },
};

export interface CameraState {
  x: number; // px lateral offset
  y: number; // px vertical offset
  z: number; // pseudo-3D scale / distance (1.0 = baseline, 2.0 = macro close-up)
  pitch: number; // deg rotateX
  yaw: number; // deg rotateY
  roll: number; // deg rotateZ
}

/**
 * Global timeline definition for the continuous 36.0s showcase (1080 frames @ 30 FPS)
 */
export const SHOWCASE_TIMELINE = {
  fps: 30,
  durationInSeconds: 36,
  durationInFrames: 1080, // 36 * 30
  milestones: {
    // 0.0s - 3.5s: Genesis (Macro curve ignition & notation)
    genesis: { start: 0, end: 105 },
    // 3.5s - 8.5s: Discovery (Pull back to reveal Vinculum workspace & title)
    discovery: { start: 105, end: 255 },
    // 8.5s - 15.0s: Push-in to live Parametric 3D canvas
    parametric: { start: 255, end: 450 },
    // 15.0s - 21.0s: Surface mesh & manifold deformation
    surfaces: { start: 450, end: 630 },
    // 21.0s - 27.0s: Vector field streamlines & particle flow
    vectorField: { start: 630, end: 810 },
    // 27.0s - 32.0s: Compute matrix & Rust/WASM telemetry
    compute: { start: 810, end: 960 },
    // 32.0s - 34.5s: Export, sharing & local-first workflow
    workflow: { start: 960, end: 1035 },
    // 34.5s - 36.0s: Geometric convergence & brand mark resolution
    convergence: { start: 1035, end: 1080 },
  },
};

/**
 * Calculates continuous virtual camera parameters at any given frame
 */
export function getShowcaseCamera(frame: number): CameraState {
  // Stage 1: Genesis (0 - 105)
  // Camera is extreme macro close-up on the tracing point (z: 2.8 -> 2.2), subtle tilt
  if (frame <= 105) {
    const progress = EASINGS.camera(interpolate(frame, [0, 105], [0, 1], { extrapolateRight: "clamp" }));
    return {
      x: interpolate(progress, [0, 1], [-80, -20]),
      y: interpolate(progress, [0, 1], [60, 10]),
      z: interpolate(progress, [0, 1], [2.6, 2.0]),
      pitch: interpolate(progress, [0, 1], [22, 14]),
      yaw: interpolate(progress, [0, 1], [-18, -8]),
      roll: interpolate(progress, [0, 1], [-4, -1]),
    };
  }

  // Stage 2: Discovery (105 - 255)
  // Pull back rapidly from macro curve to reveal the full Vinculum application window
  if (frame <= 255) {
    const progress = EASINGS.camera(interpolate(frame, [105, 255], [0, 1], { extrapolateRight: "clamp" }));
    return {
      x: interpolate(progress, [0, 1], [-20, 0]),
      y: interpolate(progress, [0, 1], [10, 0]),
      z: interpolate(progress, [0, 1], [2.0, 1.0]),
      pitch: interpolate(progress, [0, 1], [14, 4]),
      yaw: interpolate(progress, [0, 1], [-8, -2]),
      roll: interpolate(progress, [0, 1], [-1, 0]),
    };
  }

  // Stage 3: Parametric Canvas (255 - 450)
  // Camera pushes directly through into the 3D viewport with dynamic orbit
  if (frame <= 450) {
    const progress = EASINGS.camera(interpolate(frame, [255, 450], [0, 1], { extrapolateRight: "clamp" }));
    return {
      x: interpolate(progress, [0, 1], [0, 30]),
      y: interpolate(progress, [0, 1], [0, -10]),
      z: interpolate(progress, [0, 1], [1.0, 1.25]),
      pitch: interpolate(progress, [0, 1], [4, 16]),
      yaw: interpolate(progress, [0, 1], [-2, 18]),
      roll: 0,
    };
  }

  // Stage 4: Surfaces & Manifolds (450 - 630)
  // Low-angle topography sweep
  if (frame <= 630) {
    const progress = EASINGS.camera(interpolate(frame, [450, 630], [0, 1], { extrapolateRight: "clamp" }));
    return {
      x: interpolate(progress, [0, 1], [30, -20]),
      y: interpolate(progress, [0, 1], [-10, 15]),
      z: interpolate(progress, [0, 1], [1.25, 1.15]),
      pitch: interpolate(progress, [0, 1], [16, 24]),
      yaw: interpolate(progress, [0, 1], [18, -12]),
      roll: 0,
    };
  }

  // Stage 5: Vector Field (630 - 810)
  // High-speed tracking pass through streamlines
  if (frame <= 810) {
    const progress = EASINGS.camera(interpolate(frame, [630, 810], [0, 1], { extrapolateRight: "clamp" }));
    return {
      x: interpolate(progress, [0, 1], [-20, 40]),
      y: interpolate(progress, [0, 1], [15, -15]),
      z: interpolate(progress, [0, 1], [1.15, 1.35]),
      pitch: interpolate(progress, [0, 1], [24, 8]),
      yaw: interpolate(progress, [0, 1], [-12, 15]),
      roll: 0,
    };
  }

  // Stage 6: Compute & Telemetry (810 - 960)
  // Rapid pull-back as field collapses into a computation matrix
  if (frame <= 960) {
    const progress = EASINGS.camera(interpolate(frame, [810, 960], [0, 1], { extrapolateRight: "clamp" }));
    return {
      x: interpolate(progress, [0, 1], [40, 0]),
      y: interpolate(progress, [0, 1], [-15, 0]),
      z: interpolate(progress, [0, 1], [1.35, 0.95]),
      pitch: interpolate(progress, [0, 1], [8, 12]),
      yaw: interpolate(progress, [0, 1], [15, 0]),
      roll: 0,
    };
  }

  // Stage 7: Workflow & Share (960 - 1035)
  if (frame <= 1035) {
    const progress = EASINGS.camera(interpolate(frame, [960, 1035], [0, 1], { extrapolateRight: "clamp" }));
    return {
      x: interpolate(progress, [0, 1], [0, 0]),
      y: interpolate(progress, [0, 1], [0, 0]),
      z: interpolate(progress, [0, 1], [0.95, 1.05]),
      pitch: interpolate(progress, [0, 1], [12, 0]),
      yaw: 0,
      roll: 0,
    };
  }

  // Stage 8: Convergence & Brand Mark (1035 - 1080)
  const progress = EASINGS.camera(interpolate(frame, [1035, 1080], [0, 1], { extrapolateRight: "clamp" }));
  return {
    x: 0,
    y: 0,
    z: interpolate(progress, [0, 1], [1.05, 1.0]),
    pitch: 0,
    yaw: 0,
    roll: 0,
  };
}
