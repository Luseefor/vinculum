import React from "react";
import { useCurrentFrame, interpolate, spring, staticFile, useVideoConfig } from "remotion";
import { ParticleBackground } from "../components/ParticleBackground";
import { GlowBadge } from "../components/GlowBadge";
import { Layers, Eye, Cpu } from "lucide-react";

interface SceneProps {
  isVertical?: boolean;
}

export const Scene2Intro: React.FC<SceneProps> = ({ isVertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoEntrance = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 85 },
  });

  const mockupEntrance = spring({
    frame: frame - 20,
    fps,
    config: { damping: 15, stiffness: 70 },
  });

  const fadeOut = interpolate(frame, [200, 230], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 3D perspective rotation of the app mockup
  const rotateX = interpolate(frame, [20, 200], [18, 8]);
  const rotateY = interpolate(frame, [20, 200], [-12, -4]);

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center p-8 select-none overflow-hidden"
      style={{ opacity: fadeOut }}
    >
      <ParticleBackground intensity={1} gridOpacity={0.2} />

      {/* Top Header: Brand Logo & Title */}
      <div
        className="relative z-20 flex flex-col items-center text-center mt-2"
        style={{
          opacity: logoEntrance,
          transform: `translateY(${(1 - logoEntrance) * -40}px)`,
        }}
      >
        <div className="flex items-center gap-4 mb-2">
          <img
            src={staticFile("brand/logo_only.png")}
            alt="Vinculum"
            className="w-14 h-14 object-contain filter drop-shadow-[0_0_25px_rgba(59,130,246,0.8)]"
          />
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white font-sans">
            VINCULUM
          </h1>
        </div>

        <p className="text-lg md:text-xl text-slate-300 font-light max-w-xl">
          The next-generation interactive mathematical canvas.
        </p>
      </div>

      {/* 3D Perspective App Interface Showcase */}
      <div
        className="relative z-10 mt-6 w-full max-w-5xl flex justify-center perspective-[1200px]"
        style={{
          opacity: mockupEntrance,
          transform: `translateY(${(1 - mockupEntrance) * 60}px)`,
        }}
      >
        <div
          className="relative rounded-2xl p-2 bg-gradient-to-b from-slate-700/50 to-slate-900/90 shadow-[0_25px_70px_rgba(0,0,0,0.8)] border border-white/20 transition-all"
          style={{
            transform: isVertical
              ? `scale(0.85)`
              : `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(0.92)`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Mac-style window titlebar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-slate-900/80 rounded-t-xl">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="text-xs font-mono text-slate-400">
              vinculum.math / interactive-canvas
            </span>
            <div className="w-12" />
          </div>

          {/* Editor Screenshot */}
          <div className="relative rounded-b-xl overflow-hidden bg-slate-950">
            <img
              src={staticFile("landing/editor-dark.jpg")}
              alt="Vinculum Editor"
              className="w-full h-auto object-cover max-h-[500px]"
            />
            {/* Gloss reflection overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />
          </div>

          {/* Floating UI feature badges hovering in 3D */}
          <div
            className="absolute -top-6 -left-6 z-30"
            style={{ transform: "translateZ(40px)" }}
          >
            <GlowBadge
              label="Unified 2D + 3D Space"
              icon={<Eye className="w-3.5 h-3.5" />}
              color="cyan"
            />
          </div>

          <div
            className="absolute -bottom-6 -right-6 z-30"
            style={{ transform: "translateZ(50px)" }}
          >
            <GlowBadge
              label="WebGPU + Three.js Engine"
              icon={<Cpu className="w-3.5 h-3.5" />}
              color="purple"
            />
          </div>

          <div
            className="absolute -bottom-6 -left-6 z-30"
            style={{ transform: "translateZ(45px)" }}
          >
            <GlowBadge
              label="Realtime Reactive Math"
              icon={<Layers className="w-3.5 h-3.5" />}
              color="blue"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
