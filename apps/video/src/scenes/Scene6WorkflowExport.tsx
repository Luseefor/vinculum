import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { ParticleBackground } from "../components/ParticleBackground";
import { GlowBadge } from "../components/GlowBadge";
import { Share2, Download, Shield, HardDrive, Check, Link2, FileJson, Image } from "lucide-react";

interface SceneProps {
  isVertical?: boolean;
}

export const Scene6WorkflowExport: React.FC<SceneProps> = ({ isVertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  const fadeOut = interpolate(frame, [180, 210], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Animated copied state for link
  const isCopied = frame > 60;

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
          label="Workflow & Publication"
          icon={<Share2 className="w-3.5 h-3.5" />}
          color="amber"
          className="mb-3"
        />
        <h2 className="text-3xl md:text-5xl font-extrabold text-white">
          Built For Flow, Sharing & Research
        </h2>
        <p className="mt-2 text-base md:text-lg text-slate-300">
          From interactive classroom demonstrations to vector publication figures.
        </p>
      </div>

      {/* Center 3-Card Showcase */}
      <div
        className={`relative z-10 w-full max-w-6xl flex ${
          isVertical ? "flex-col items-center gap-6" : "flex-row items-center justify-center gap-8"
        } my-auto`}
        style={{
          opacity: entrance,
          transform: `scale(${entrance})`,
        }}
      >
        {/* Card 1: Shareable Links */}
        <div className="flex-1 glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">One-Click Link Sharing</h3>
            <p className="text-sm text-slate-400 mt-1">
              Entire scenes compressed directly into the URL payload. Send anyone a link with zero login required.
            </p>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-lg border border-white/5 flex items-center justify-between font-mono text-xs">
            <span className="text-slate-300 truncate max-w-[200px]">
              vinculum.math/#scene=eJw1jc...
            </span>
            <span
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                isCopied
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-blue-500/20 text-blue-400"
              }`}
            >
              {isCopied ? <Check className="w-3 h-3" /> : null}
              {isCopied ? "Copied!" : "Copy"}
            </span>
          </div>
        </div>

        {/* Card 2: Multi-format Export */}
        <div className="flex-1 glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Vector & High-Res Export</h3>
            <p className="text-sm text-slate-400 mt-1">
              Export pixel-perfect vector SVG for LaTeX papers, 4K PNG for slides, or portable Scene JSON.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-amber-300 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              SVG Vector
            </div>
            <div className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-cyan-300 flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5" />
              PNG 4K
            </div>
            <div className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-purple-300 flex items-center gap-1.5">
              <FileJson className="w-3.5 h-3.5" />
              JSON Data
            </div>
          </div>
        </div>

        {/* Card 3: Local-First Privacy */}
        <div className="flex-1 glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">100% Local-First Privacy</h3>
            <p className="text-sm text-slate-400 mt-1">
              Equations and scenes stay inside your browser. Autosave and session recovery protect your work offline.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
            <HardDrive className="w-4 h-4" />
            <span>Local Browser Storage & Offline First</span>
          </div>
        </div>
      </div>
    </div>
  );
};
