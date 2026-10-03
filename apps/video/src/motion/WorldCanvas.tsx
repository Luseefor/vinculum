import React from "react";
import { CameraState } from "./camera";

interface WorldCanvasProps {
  camera: CameraState;
  children: React.ReactNode;
  isVertical?: boolean;
}

/**
 * WorldCanvas
 * The persistent 3D spatial continuum of Vinculum.
 * Applies continuous camera transformations, responsive perspective, and depth layers.
 */
export const WorldCanvas: React.FC<WorldCanvasProps> = ({
  camera,
  children,
  isVertical = false,
}) => {
  const perspective = isVertical ? 900 : 1200;

  return (
    <div
      className="relative w-full h-full bg-[#050811] text-white overflow-hidden select-none font-sans"
      style={{
        perspective: `${perspective}px`,
        perspectiveOrigin: "50% 50%",
      }}
    >
      {/* 3D Camera Rig */}
      <div
        className="w-full h-full relative"
        style={{
          transformStyle: "preserve-3d",
          transform: `
            translate3d(${-camera.x}px, ${-camera.y}px, 0px)
            scale(${camera.z})
            rotateX(${camera.pitch}deg)
            rotateY(${camera.yaw}deg)
            rotateZ(${camera.roll}deg)
          `,
          transformOrigin: "50% 50%",
          willChange: "transform",
        }}
      >
        {children}
      </div>

      {/* Global Vignette and Technical Lens Halo (Screen Space HUD) */}
      <div
        className="absolute inset-0 pointer-events-none z-40"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgba(5,8,17,0.7) 85%, #050811 100%)",
        }}
      />
    </div>
  );
};
