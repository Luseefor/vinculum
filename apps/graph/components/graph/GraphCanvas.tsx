"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import type { GraphObject } from "@vinculum/scene/types";
import { MOUSE, TOUCH } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { dispatchGraphInteractionEvent, useAdaptiveResolution } from "@/hooks/useAdaptiveResolution";
import { useGraphStore } from "@/store/graphStore";
import AxesHelper from "./AxesHelper";
import AxisLabels from "./AxisLabels";
import InfiniteGrid from "./InfiniteGrid";
import ParametricCurve from "./ParametricCurve";
import PlaneMesh from "./PlaneMesh";
import SurfaceMesh from "./SurfaceMesh";

const DEFAULT_3D_CAMERA_POSITION: [number, number, number] = [8, 7, 8];
const DEFAULT_2D_CAMERA_POSITION: [number, number, number] = [0, 40, 0.001];
const DEFAULT_TARGET: [number, number, number] = [0, 0, 0];

export default function GraphCanvas() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const didMountRef = useRef(false);

  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const viewportMode = useGraphStore((state) => state.ui.viewportMode);
  const cameraResetVersion = useGraphStore((state) => state.cameraResetVersion);

  const { resolutionMultiplier, isInteractive } = useAdaptiveResolution();
  const is2DMode = viewportMode === "2d";

  const visibleObjects = useMemo(() => objects.filter((object) => object.visible), [objects]);

  const renderedObjects = useMemo(
    () =>
      visibleObjects.map((object) => (
        <GraphObjectRenderer
          key={object.id}
          object={object}
          isSelected={object.id === selectedObjectId}
          resolutionMultiplier={resolutionMultiplier}
          isInteractive={isInteractive}
        />
      )),
    [isInteractive, resolutionMultiplier, selectedObjectId, visibleObjects]
  );

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    controls.reset();
    controls.target.set(...DEFAULT_TARGET);

    if (is2DMode) {
      controls.object.position.set(...DEFAULT_2D_CAMERA_POSITION);
      controls.object.up.set(0, 0, 1);
    } else {
      controls.object.position.set(...DEFAULT_3D_CAMERA_POSITION);
      controls.object.up.set(0, 1, 0);
    }

    controls.update();
  }, [cameraResetVersion, is2DMode]);

  const cameraProps = is2DMode
    ? { position: DEFAULT_2D_CAMERA_POSITION, zoom: 42, near: 0.1, far: 1_800 }
    : { position: DEFAULT_3D_CAMERA_POSITION, fov: 48, near: 0.1, far: 500 };

  return (
    <div className="h-full w-full">
      <Canvas key={viewportMode} camera={cameraProps} orthographic={is2DMode}>
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.38} />
        <hemisphereLight intensity={0.24} groundColor="#020617" color="#cbd5e1" />
        <directionalLight intensity={0.95} position={[8, 10, 6]} />
        <directionalLight intensity={0.32} position={[-6, 4, -8]} />

        <InfiniteGrid />
        <AxesHelper viewportMode={viewportMode} />
        <AxisLabels viewportMode={viewportMode} />

        {renderedObjects}

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          enablePan
          enableRotate={!is2DMode}
          screenSpacePanning
          zoomToCursor
          dampingFactor={0.08}
          panSpeed={0.9}
          minDistance={0.4}
          maxDistance={300}
          minPolarAngle={is2DMode ? 0 : 0.04}
          maxPolarAngle={is2DMode ? 0 : Math.PI - 0.04}
          target={DEFAULT_TARGET}
          mouseButtons={
            is2DMode
              ? { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }
              : { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }
          }
          touches={
            is2DMode
              ? { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }
              : { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }
          }
          onStart={dispatchGraphInteractionEvent}
          onChange={dispatchGraphInteractionEvent}
        />
      </Canvas>
    </div>
  );
}

interface GraphObjectRendererProps {
  object: GraphObject;
  isSelected: boolean;
  resolutionMultiplier: number;
  isInteractive: boolean;
}

const GraphObjectRenderer = memo(function GraphObjectRenderer({
  object,
  isSelected,
  resolutionMultiplier,
  isInteractive
}: GraphObjectRendererProps) {
  if (!object.visible) {
    return null;
  }

  if (object.kind === "surface") {
    return (
      <SurfaceMesh
        object={object}
        isSelected={isSelected}
        resolutionMultiplier={resolutionMultiplier}
        isInteractive={isInteractive}
      />
    );
  }

  if (object.kind === "parametricCurve") {
    return (
      <ParametricCurve
        object={object}
        isSelected={isSelected}
        resolutionMultiplier={resolutionMultiplier}
        isInteractive={isInteractive}
      />
    );
  }

  if (object.kind === "plane") {
    return <PlaneMesh object={object} isSelected={isSelected} />;
  }

  return null;
});
