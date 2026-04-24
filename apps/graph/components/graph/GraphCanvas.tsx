"use client";

import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { GraphObject } from "@vinculum/scene/types";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { dispatchGraphInteractionEvent, useAdaptiveResolution } from "@/hooks/useAdaptiveResolution";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { useGraphStore } from "@/store/graphStore";
import AxesHelper from "./AxesHelper";
import AxisLabels from "./AxisLabels";
import InfiniteGrid from "./InfiniteGrid";
import ParametricCurve from "./ParametricCurve";
import PlaneMesh from "./PlaneMesh";
import SurfaceMesh from "./SurfaceMesh";

const DEFAULT_CAMERA_POSITION: [number, number, number] = [6, 6, 6];
const CAMERA_FAR_PLANE = 30_000;
export default function GraphCanvas() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const didMountRef = useRef(false);
  const resolvedTheme = useResolvedTheme();

  const objects = useGraphStore((state) => state.scene.objects);
  const cameraResetVersion = useGraphStore((state) => state.cameraResetVersion);

  const { resolutionMultiplier, isInteractive } = useAdaptiveResolution();

  const visibleObjects = useMemo(() => objects.filter((object) => object.visible), [objects]);
  const hasSurfaceObjects = useMemo(
    () => visibleObjects.some((object) => object.kind === "surface"),
    [visibleObjects]
  );

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

  const sceneColors = useMemo(() => getGraphThemeTokens(resolvedTheme), [resolvedTheme]);

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
    <div className="relative h-full w-full overflow-hidden">
      <Canvas
        shadows={hasSurfaceObjects}
        camera={{ position: DEFAULT_CAMERA_POSITION, fov: 48, near: 0.1, far: CAMERA_FAR_PLANE }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance"
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1;
        }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[sceneColors.surfaceCanvas]} />
        <ambientLight intensity={sceneColors.sceneAmbientIntensity} />
        <hemisphereLight
          intensity={sceneColors.sceneHemiIntensity}
          groundColor={sceneColors.sceneHemiGround}
          color={sceneColors.sceneHemiSky}
        />
        <directionalLight
          intensity={sceneColors.sceneKeyIntensity}
          position={[8, 10, 6]}
          castShadow={hasSurfaceObjects}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-normalBias={0.02}
          shadow-bias={-0.00008}
        />
        <directionalLight intensity={sceneColors.sceneFillIntensity} position={[-6, 4, -8]} />
        <Environment preset={resolvedTheme === "dark" ? "city" : "sunset"} background={false} />
        {hasSurfaceObjects && (
          <ContactShadows
            position={[0, -0.0015, 0]}
            opacity={resolvedTheme === "dark" ? 0.34 : 0.22}
            width={180}
            height={180}
            blur={2.4}
            far={220}
            resolution={1024}
            color={resolvedTheme === "dark" ? "#000000" : "#334155"}
          />
        )}

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
          maxDistance={80_000}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
          target={[0, 0, 0]}
          onStart={dispatchGraphInteractionEvent}
          onChange={dispatchGraphInteractionEvent}
        />
        <CameraDistanceSynchronizer />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/80 px-2 py-1 text-[10px] text-[var(--text-secondary)] backdrop-blur">
        3D View · Drag orbit · Right-drag pan · Scroll zoom
      </div>
    </div>
  );
}

function CameraDistanceSynchronizer() {
  const { camera } = useThree();

  useFrame(() => {
    const distance = Math.hypot(camera.position.x, camera.position.y, camera.position.z);
    const near = Math.max(0.05, distance / 6_000);
    const far = Math.max(CAMERA_FAR_PLANE, distance * 25);

    if (Math.abs(camera.near - near) > 1e-6 || Math.abs(camera.far - far) > 0.5) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  });

  return null;
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
