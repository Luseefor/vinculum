import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { ParticleBackground } from "../components/ParticleBackground";
import { SurfaceMesh3D } from "../visualizers/SurfaceMesh3D";
import { FormulaCard } from "../components/FormulaCard";
import { GlowBadge } from "../components/GlowBadge";
import { Grid, Eye, CheckCircle2 } from "lucide-react";

interface SceneProps {
  isVertical?: boolean;
}

export const Scene4Surfaces: React.FC<SceneProps> = ({ isVertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  const fadeOut = interpolate(frame, [210, 240], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Toggle wireframe mode dynamically at frame 110 to show off wireframe feature!
  const isWireframe = frame > 110 && frame < 180;

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-between p-10 select-none overflow-hidden"
      style={{ opacity: fadeOut }}
    >
      <ParticleBackground intensity={1} gridOpacity={0.2} />

      {/* Header */}
      <div
        className="relative z-10 flex flex-col items-center text-center max-w-3xl"
        style={{
          opacity: entrance,
          transform: `translateY(${(1 - entrance) * -30}px)`,
        }}
      >
        <GlowBadge
          label="Surfaces & Implicit Manifolds"
          icon={<Grid className="w-3.5 h-3.5" />}
          color="purple"
          className="mb-3"
        />
        <h2 className="text-3xl md:text-5xl font-extrabold text-white">
          Complex Mathematical Surfaces
        </h2>
        <p className="mt-2 text-base md:text-lg text-slate-300">
          From harmonic explicit equations to non-orientable topology. Rendered with hardware-accelerated materials.
        </p>
      </div>

      {/* Center Display: 3D Surface Mesh on Left, Mathematical Controls on Right */}
      <div
        className={`relative z-10 w-full max-w-6xl flex ${
          isVertical ? "flex-col items-center gap-6" : "flex-row-reverse items-center justify-between gap-10"
        } my-auto`}
        style={{
          opacity: entrance,
          transform: `scale(${entrance})`,
        }}
      >
        {/* Math Formulas and Surface Inspector */}
        <div className="flex-1 flex flex-col gap-4 max-w-md w-full">
          <FormulaCard
            latex="z = \sin(x) \cdot \cos(y)"
            label="Explicit Surface"
            badge="Adaptive Mesh"
            glowColor="purple"
            parameters={{
              "x_domain": "[-5, 5]",
              "y_domain": "[-5, 5]",
              "resolution": "80x80",
              "wireframe": isWireframe ? "Enabled" : "Shaded",
            }}
          />

          <div className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col gap-3">
            <span className="text-xs font-mono text-purple-400 tracking-wider">
              SURFACE CAPABILITIES
            </span>

            <div className="flex flex-col gap-2 text-sm text-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Implicit Equations (x² + y² + z² - 9 = 0)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Planes (Ax + By + Cz + D = 0)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Custom parametric surfaces (u, v) ↦ ℝ³</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Dynamic lighting, normals & wireframe mode</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3D Surface Canvas */}
        <div className="flex-1 flex justify-center items-center relative">
          <div className="glass-panel p-4 rounded-3xl border border-purple-500/20 shadow-[0_0_60px_rgba(168,85,247,0.2)]">
            <SurfaceMesh3D
              width={isVertical ? 460 : 640}
              height={isVertical ? 380 : 440}
              resolution={24}
              wireframeOnly={isWireframe}
            />

            {/* Mode Indicator Overlay */}
            <div className="absolute top-8 left-8 glass-pill px-3 py-1 rounded-full text-xs font-mono text-slate-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-purple-400" />
              {isWireframe ? "Wireframe Inspection" : "Node-Based Material"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
