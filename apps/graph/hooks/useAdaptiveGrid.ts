"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useState } from "react";
import { getGridSettings, snapToGrid } from "@/lib/graph/grid";

interface AdaptiveGridState {
  majorStep: number;
  minorStep: number;
  fadeDistance: number;
  gridOffset: [number, number];
}

export function useAdaptiveGrid() {
  const { camera } = useThree();

  const [state, setState] = useState<AdaptiveGridState>(() =>
    createAdaptiveGridState(camera.position.x, camera.position.y, camera.position.z)
  );
  const stateRef = useRef(state);

  useFrame(({ camera: frameCamera }) => {
    const nextState = createAdaptiveGridState(
      frameCamera.position.x,
      frameCamera.position.y,
      frameCamera.position.z
    );

    if (hasStateChanged(stateRef.current, nextState)) {
      stateRef.current = nextState;
      setState(nextState);
    }
  });

  return state;
}

function createAdaptiveGridState(
  cameraX: number,
  cameraY: number,
  cameraZ: number
): AdaptiveGridState {
  const cameraDistance = Math.hypot(cameraX, cameraY, cameraZ);
  const settings = getGridSettings(cameraDistance);

  // Future floating-origin support can swap this snapping anchor with an origin-shift offset.
  const gridOffset: [number, number] = [
    snapToGrid(cameraX, settings.majorStep),
    snapToGrid(cameraZ, settings.majorStep)
  ];

  return {
    majorStep: settings.majorStep,
    minorStep: settings.minorStep,
    fadeDistance: settings.fadeDistance,
    gridOffset
  };
}

function hasStateChanged(a: AdaptiveGridState, b: AdaptiveGridState): boolean {
  return (
    a.majorStep !== b.majorStep ||
    a.minorStep !== b.minorStep ||
    Math.abs(a.fadeDistance - b.fadeDistance) > 0.001 ||
    a.gridOffset[0] !== b.gridOffset[0] ||
    a.gridOffset[1] !== b.gridOffset[1]
  );
}
