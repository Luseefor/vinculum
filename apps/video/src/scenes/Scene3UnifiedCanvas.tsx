import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { ParticleBackground } from "../components/ParticleBackground";
import { ParametricHelix3D } from "../visualizers/ParametricHelix3D";
import { FormulaCard } from "../components/FormulaCard";
import { GlowBadge } from "../components/GlowBadge";
import { Compass, Sliders, Box } from "lucide-react";

interface SceneProps {
  isVertical?: boolean;
}

export const Scene3UnifiedCanvas: React.FC<SceneProps> = ({ isVertical = false }) => {
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

  // Animated parameter tMax
  const tMaxVal = interpolate(frame, [0, 180], [1, 4 * Math.PI]).toFixed(2);

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-between p-10 select-none overflow-hidden"
      style={{ opacity: fadeOut }}
    >
      <ParticleBackground intensity={1.1} gridOpacity={0.25} />

      {/* Header */}
      <div
        className="relative z-10 flex flex-col items-center text-center max-w-3xl"
        style={{
          opacity: entrance,
          transform: `translateY(${(1 - entrance) * -30}px)`,
        }}
      >
        <GlowBadge
          label="Parametric Curves & Trajectories"
          icon={<Compass className="w-3.5 h-3.5" />}
          color="cyan"
          className="mb-3"
        />
        <h2 className="text-3xl md:text-5xl font-extrabold text-white">
          Unified 2D & 3D Spatial Canvas
        </h2>
        <p className="mt-2 text-base md:text-lg text-slate-300">
          Plot curves on 2D planes or lift them into true 3D space with continuous differential geometry.
        </p>
      </div>

      {/* Main Dual Viewport: Math Expressions on Left, 3D Canvas on Right */}
      <div
        className={`relative z-10 w-full max-w-6xl flex ${
          isVertical ? "flex-col items-center gap-6" : "flex-row items-center justify-between gap-10"
        } my-auto`}
        style={{
          opacity: entrance,
          transform: `scale(${entrance})`,
        }}
      >
        {/* Left Side: Math Expression Cards & Inspector */}
        <div className="flex-1 flex flex-col gap-4 max-w-md w-full">
          <FormulaCard
            latex="\mathbf{r}(t) = \begin{pmatrix} \cos(t) \\ \sin(t) \\ t / 3 \end{pmatrix}, \quad t \in [0, 4\pi]"
            label="Parametric Helix"
            badge="Three.js Viewport"
            glowColor="cyan"
            parameters={{
              "t_min": "0.00",
              "t_max": `${tMaxVal}`,
              "samples": 220,
              "tangent": "T(t) active",
            }}
          />

          {/* Interactive UI Mock Card */}
          <div className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Sliders className="w-3.5 h-3.5" />
                PARAMETER SWEEP
              </span>
              <span className="text-emerald-400">60.0 FPS</span>
            </div>

            {/* Slider 1 */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Curve Radius (R)</span>
                <span className="font-mono text-cyan-300">1.00</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 w-3/4 rounded-full" />
              </div>
            </div>

            {/* Slider 2 */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Pitch Factor (c)</span>
                <span className="font-mono text-cyan-300">0.33</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 w-1/3 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive 3D Canvas */}
        <div className="flex-1 flex justify-center items-center relative">
          <div className="glass-panel p-4 rounded-3xl border border-cyan-500/20 shadow-[0_0_60px_rgba(6,182,212,0.18)]">
            <ParametricHelix3D
              width={isVertical ? 460 : 640}
              height={isVertical ? 380 : 440}
              color="#38bdf8"
              speed={1.1}
            />

            {/* Floating 3D Badge */}
            <div className="absolute top-8 right-8 glass-pill px-3 py-1 rounded-full text-xs font-mono text-slate-300 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-cyan-400" />
              Realtime 3D Orbit
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
