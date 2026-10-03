import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { ParticleBackground } from "../components/ParticleBackground";
import { FormulaCard } from "../components/FormulaCard";
import { GlowBadge } from "../components/GlowBadge";
import { Sparkles } from "lucide-react";

interface SceneProps {
  isVertical?: boolean;
}

export const Scene1Hook: React.FC<SceneProps> = ({ isVertical = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance animations
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  const fadeOut = interpolate(frame, [180, 210], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center p-8 select-none"
      style={{ opacity: fadeOut }}
    >
      <ParticleBackground intensity={1.2} gridOpacity={0.3} />

      {/* Floating mathematical formula elements in background */}
      <div
        className="absolute top-16 left-12 scale-90 opacity-40 blur-[0.5px]"
        style={{
          transform: `translateY(${Math.sin(frame * 0.03) * 15}px) rotate(-4deg)`,
        }}
      >
        <FormulaCard
          latex="\nabla \times \mathbf{B} = \mu_0 \left( \mathbf{J} + \varepsilon_0 \frac{\partial \mathbf{E}}{\partial t} \right)"
          label="Field Dynamics"
          delay={10}
        />
      </div>

      <div
        className="absolute bottom-16 right-12 scale-90 opacity-40 blur-[0.5px]"
        style={{
          transform: `translateY(${-Math.cos(frame * 0.03) * 15}px) rotate(3deg)`,
        }}
      >
        <FormulaCard
          latex="e^{i\pi} + 1 = 0 \quad \iff \quad z = \sum_{n=0}^{\infty} \frac{x^n}{n!}"
          label="Euler Identity"
          delay={20}
        />
      </div>

      {/* Center Hero Content */}
      <div className="relative z-10 flex flex-col items-center max-w-4xl text-center">
        <div style={{ opacity: titleSpring, transform: `scale(${titleSpring})` }}>
          <GlowBadge
            label="The Genesis of Spatial Mathematics"
            icon={<Sparkles className="w-3.5 h-3.5" />}
            color="cyan"
            className="mb-8"
          />
        </div>

        <h1
          className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight"
          style={{
            opacity: titleSpring,
            transform: `translateY(${(1 - titleSpring) * 30}px)`,
          }}
        >
          Mathematics was never meant to be{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 drop-shadow-[0_0_35px_rgba(6,182,212,0.6)]">
            flat and static.
          </span>
        </h1>

        <p
          className="mt-6 text-xl md:text-2xl text-slate-300 font-light max-w-2xl leading-relaxed"
          style={{
            opacity: spring({ frame: frame - 18, fps, config: { damping: 14 } }),
            transform: `translateY(${
              (1 - spring({ frame: frame - 18, fps, config: { damping: 14 } })) * 20
            }px)`,
          }}
        >
          Traditional tools trap dynamic spatial geometry on chalkboard lines and 2D screens.
        </p>

        {/* Central glowing formula reveal */}
        <div
          className="mt-10"
          style={{
            opacity: spring({ frame: frame - 35, fps, config: { damping: 14 } }),
            transform: `scale(${spring({
              frame: frame - 35,
              fps,
              config: { damping: 14 },
            })})`,
          }}
        >
          <div className="glass-panel px-8 py-5 rounded-2xl border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.25)] flex items-center gap-6">
            <span className="text-sm font-mono text-cyan-400 tracking-wider">
              WHAT IF EQUATIONS COULD LIVE IN SPACE?
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
