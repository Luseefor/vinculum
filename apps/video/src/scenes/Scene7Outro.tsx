import React from "react";
import { useCurrentFrame, spring, staticFile, useVideoConfig } from "remotion";
import { ParticleBackground } from "../components/ParticleBackground";
import { ArrowRight, Terminal, Star } from "lucide-react";

interface SceneProps {
  isVertical?: boolean;
}

export const Scene7Outro: React.FC<SceneProps> = ({ isVertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoEntrance = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 90 },
  });

  const ctaEntrance = spring({
    frame: frame - 25,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-8 select-none overflow-hidden">
      <ParticleBackground intensity={1.4} gridOpacity={0.35} />

      {/* Center Grand Logo */}
      <div
        className="relative z-10 flex flex-col items-center text-center max-w-3xl"
        style={{
          opacity: logoEntrance,
          transform: `scale(${logoEntrance})`,
        }}
      >
        {/* Glow halo behind logo */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-500 rounded-full blur-[60px] opacity-50 scale-150 animate-pulse" />
          <img
            src={staticFile("brand/logo_only.png")}
            alt="Vinculum Logo"
            className="relative w-28 h-28 object-contain filter drop-shadow-[0_0_40px_rgba(59,130,246,0.9)]"
          />
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white font-sans">
          VINCULUM
        </h1>

        <p className="mt-4 text-2xl md:text-3xl font-light text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-cyan-200 to-indigo-300">
          See the beauty in every equation.
        </p>

        <p className="mt-3 text-slate-400 text-base md:text-lg max-w-xl">
          The open-source interactive 3D math editor for thinkers, educators, and engineers.
        </p>
      </div>

      {/* CTA Buttons & Terminal Command */}
      <div
        className="relative z-10 mt-10 flex flex-col items-center gap-5"
        style={{
          opacity: ctaEntrance,
          transform: `translateY(${(1 - ctaEntrance) * 30}px)`,
        }}
      >
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="px-6 py-3 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-base shadow-[0_0_30px_rgba(6,182,212,0.4)] flex items-center gap-2 border border-white/20">
            <span>Explore the Canvas</span>
            <ArrowRight className="w-4 h-4" />
          </div>

          <div className="glass-panel px-5 py-3 rounded-full text-slate-200 font-mono text-sm flex items-center gap-2 border border-white/10">
            <svg
              className="w-4 h-4 fill-current text-white"
              viewBox="0 0 24 24"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>GitHub / Open Source</span>
            <span className="flex items-center text-amber-400 text-xs ml-1">
              <Star className="w-3 h-3 fill-amber-400 inline" />
            </span>
          </div>
        </div>

        {/* Quickstart bash command */}
        <div className="glass-pill px-5 py-2 rounded-xl text-xs font-mono text-slate-400 flex items-center gap-3 border border-white/10">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>git clone &amp;&amp; bun install &amp;&amp; bun run dev</span>
        </div>
      </div>
    </div>
  );
};
