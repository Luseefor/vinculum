"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import type { GraphObject } from "@vinculum/scene/types";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { dispatchGraphInteractionEvent, useAdaptiveResolution } from "@/hooks/useAdaptiveResolution";
import { useGraphStore } from "@/store/graphStore";
import AxesHelper from "./AxesHelper";
import AxisLabels from "./AxisLabels";
import InfiniteGrid from "./InfiniteGrid";
import ParametricCurve from "./ParametricCurve";
import PlaneMesh from "./PlaneMesh";
import SurfaceMesh from "./SurfaceMesh";

const DEFAULT_CAMERA_POSITION: [number, number, number] = [6, 6, 6];

export default function GraphCanvas() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const didMountRef = useRef(false);

  const objects = useGraphStore((state) => state.scene.objects);
  const cameraResetVersion = useGraphStore((state) => state.cameraResetVersion);

  const { resolutionMultiplier, isInteractive } = useAdaptiveResolution();

  const visibleObjects = useMemo(() => objects.filter((object) => object.visible), [objects]);

  const renderedObjects = useMemo(
    () =>
      visibleObjects.map((object) => (
        <GraphObjectRenderer
          key={object.id}
          object={object}
          resolutionMultiplier={resolutionMultiplier}
          isInteractive={isInteractive}
        />
      )),
    [isInteractive, resolutionMultiplier, visibleObjects]
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
    controls.object.position.set(...DEFAULT_CAMERA_POSITION);
    controls.target.set(0, 0, 0);
    controls.update();
  }, [cameraResetVersion]);

  return (
    <div className="h-full w-full">
      <Canvas camera={{ position: DEFAULT_CAMERA_POSITION, fov: 48, near: 0.1, far: 500 }}>
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.38} />
        <hemisphereLight intensity={0.24} groundColor="#020617" color="#cbd5e1" />
        <directionalLight intensity={0.95} position={[8, 10, 6]} />
        <directionalLight intensity={0.32} position={[-6, 4, -8]} />

        <InfiniteGrid />
        <AxesHelper />
        <AxisLabels />

        {renderedObjects}

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={1.5}
          maxDistance={300}
          minPolarAngle={0.04}
          maxPolarAngle={Math.PI - 0.04}
          target={[0, 0, 0]}
          onStart={dispatchGraphInteractionEvent}
          onChange={dispatchGraphInteractionEvent}
        />
      </Canvas>
    </div>
  );
}

interface GraphObjectRendererProps {
  object: GraphObject;
  resolutionMultiplier: number;
  isInteractive: boolean;
}

const GraphObjectRenderer = memo(function GraphObjectRenderer({
  object,
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
        resolutionMultiplier={resolutionMultiplier}
        isInteractive={isInteractive}
      />
    );
  }

  if (object.kind === "parametricCurve") {
    return (
      <ParametricCurve
        object={object}
        resolutionMultiplier={resolutionMultiplier}
        isInteractive={isInteractive}
      />
    );
  }

  if (object.kind === "plane") {
    return <PlaneMesh object={object} />;
  }

  return null;
});
