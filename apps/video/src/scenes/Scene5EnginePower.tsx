import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { ParticleBackground } from "../components/ParticleBackground";
import { VectorFieldSimulation } from "../visualizers/VectorFieldSimulation";
import { GlowBadge } from "../components/GlowBadge";
import { Zap, Activity, Cpu, ShieldCheck } from "lucide-react";

interface SceneProps {
  isVertical?: boolean;
}

export const Scene5EnginePower: React.FC<SceneProps> = ({ isVertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  const fadeOut = interpolate(frame, [200, 230], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-between p-10 select-none overflow-hidden"
      style={{ opacity: fadeOut }}
    >
      <ParticleBackground intensity={1.2} gridOpacity={0.25} />

      {/* Header */}
      <div
        className="relative z-10 flex flex-col items-center text-center max-w-3xl"
        style={{
          opacity: entrance,
          transform: `translateY(${(1 - entrance) * -30}px)`,
        }}
      >
        <GlowBadge
          label="Extreme Computational Throughput"
          icon={<Zap className="w-3.5 h-3.5" />}
          color="emerald"
          className="mb-3"
        />
        <h2 className="text-3xl md:text-5xl font-extrabold text-white">
          Powered by Rust & WebAssembly
        </h2>
        <p className="mt-2 text-base md:text-lg text-slate-300">
          Heavy numerical differentiation, vector field sampling, and mesh construction running in native-speed WASM.
        </p>
      </div>

      {/* Main Content: Vector Field Streamlines & Performance Metrics */}
      <div
        className={`relative z-10 w-full max-w-6xl flex ${
          isVertical ? "flex-col items-center gap-6" : "flex-row items-center justify-between gap-10"
        } my-auto`}
        style={{
          opacity: entrance,
          transform: `scale(${entrance})`,
        }}
      >
        {/* Performance HUD Panel */}
        <div className="flex-1 flex flex-col gap-4 max-w-md w-full">
          <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2)] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-white">
                  COMPUTE ARCHITECTURE
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-mono">
                vinculum-math-core
              </span>
            </div>

            {/* Live Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
                <span className="text-xs text-slate-400">Frame Budget</span>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  60.0 <span className="text-sm font-normal text-slate-400">FPS</span>
                </div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
                <span className="text-xs text-slate-400">WASM Eval Latency</span>
                <div className="text-2xl font-bold font-mono text-cyan-400">
                  0.34 <span className="text-sm font-normal text-slate-400">ms</span>
                </div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
                <span className="text-xs text-slate-400">Points Sampled</span>
                <div className="text-2xl font-bold font-mono text-white">
                  128k <span className="text-sm font-normal text-slate-400">grid</span>
                </div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
                <span className="text-xs text-slate-400">WebGPU Pipeline</span>
                <div className="text-2xl font-bold font-mono text-purple-400">
                  Active <span className="text-sm font-normal text-slate-400">NodeMat</span>
                </div>
              </div>
            </div>

            {/* Expression Safety */}
            <div className="flex items-center gap-2 text-xs text-slate-300 pt-2 border-t border-white/10">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Safety guards against infinite loops & division anomalies</span>
            </div>
          </div>
        </div>

        {/* Vector Field Canvas */}
        <div className="flex-1 flex justify-center items-center relative">
          <div className="glass-panel p-4 rounded-3xl border border-emerald-500/20 shadow-[0_0_60px_rgba(16,185,129,0.2)]">
            <VectorFieldSimulation
              width={isVertical ? 460 : 640}
              height={isVertical ? 380 : 440}
            />

            {/* Streamline Flow Badge */}
            <div className="absolute top-8 left-8 glass-pill px-3 py-1 rounded-full text-xs font-mono text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Vector Field Streamlines (Euler & RK2)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
