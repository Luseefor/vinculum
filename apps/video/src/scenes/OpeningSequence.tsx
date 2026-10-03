import React from "react";
import { interpolate, staticFile } from "remotion";
import { EASINGS } from "../motion/camera";
import { OpeningTrajectory } from "../visualizers/OpeningTrajectory";
import katex from "katex";

interface OpeningSequenceProps {
  frame: number;
  isVertical?: boolean;
}

/**
 * OpeningSequence (0s - 8.5s / Frames 0 - 255)
 * Equation -> Space -> System
 * Starts in macro darkness, traces parametric curve r(t), pulls back to reveal Vinculum workspace.
 */
export const OpeningSequence: React.FC<OpeningSequenceProps> = ({
  frame,
  isVertical = false,
}) => {
  // Phase 1: Macro Notation (0 - 105 frames)
  const notationOpacity = interpolate(frame, [15, 45, 95, 115], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Render raw KaTeX formulas deterministically
  const formulaHtml = katex.renderToString(
    "\\mathbf{r}(t) = \\begin{pmatrix} \\cos(1.5t) \\\\ \\sin(1.5t) \\\\ t/3 \\end{pmatrix}",
    { displayMode: false, throwOnError: false }
  );

  const tangentHtml = katex.renderToString(
    "\\mathbf{T}(t) = \\frac{\\mathbf{r}'(t)}{\\|\\mathbf{r}'(t)\\|}",
    { displayMode: false, throwOnError: false }
  );

  // Phase 2: Application Window Reveal (105 - 255 frames)
  const windowProgress = EASINGS.camera(
    interpolate(frame, [105, 185], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  const windowOpacity = interpolate(frame, [105, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Brand identity reveal (160 - 255 frames)
  const brandOpacity = interpolate(frame, [160, 200], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const brandY = interpolate(
    EASINGS.snap(
      interpolate(frame, [160, 200], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    ),
    [0, 1],
    [24, 0]
  );

  // Push through to next section (frame 220 -> 255)
  const exitZoom = interpolate(frame, [220, 255], [1, 1.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{
        transform: `scale(${exitZoom})`,
      }}
    >
      {/* 1. Macro Parametric Curve Trajectory (Canvas 3D) */}
      <div
        className="absolute inset-0"
        style={{
          opacity: interpolate(frame, [180, 240], [1, 0.4], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <OpeningTrajectory frame={frame} width={1920} height={1080} />
      </div>

      {/* 2. Mathematical Floating HUD Notation (Frames 15 - 110) */}
      <div
        className="absolute z-20 flex flex-col gap-3 font-mono text-xs text-cyan-300 pointer-events-none"
        style={{
          top: isVertical ? "28%" : "32%",
          left: isVertical ? "10%" : "22%",
          opacity: notationOpacity,
          transform: `translateY(${interpolate(frame, [15, 105], [15, -15])}px)`,
        }}
      >
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 px-3 py-1.5 rounded shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-slate-400 font-semibold tracking-wider uppercase text-[10px]">
            Trajectory Vector
          </span>
          <div
            dangerouslySetInnerHTML={{ __html: formulaHtml }}
            className="text-white text-sm ml-1"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-rose-500/30 px-3 py-1.5 rounded shadow-lg w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span className="text-slate-400 font-semibold tracking-wider uppercase text-[10px]">
            Velocity Unit
          </span>
          <div
            dangerouslySetInnerHTML={{ __html: tangentHtml }}
            className="text-rose-300 text-sm ml-1"
          />
        </div>
      </div>

      {/* 3. The Real Vinculum Application Window Mockup (Frames 105 - 255) */}
      <div
        className="relative z-10 transition-transform duration-75 flex flex-col items-center justify-center"
        style={{
          opacity: windowOpacity,
          width: isVertical ? "92%" : "72%",
          maxWidth: "1350px",
          transform: `
            scale(${interpolate(windowProgress, [0, 1], [0.85, 1])})
            rotateX(${interpolate(windowProgress, [0, 1], [15, 4])}deg)
            rotateY(${interpolate(windowProgress, [0, 1], [-12, -2])}deg)
          `,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Editor Frame Chrome */}
        <div className="w-full rounded-xl overflow-hidden border border-cyan-500/30 shadow-[0_20px_70px_rgba(0,0,0,0.8),0_0_40px_rgba(6,182,212,0.15)] bg-slate-950">
          {/* macOS window titlebar */}
          <div className="h-9 bg-[#0b101e] px-4 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-3 font-mono text-xs text-slate-400">
                vinculum — space_curve_differential.vnc
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-cyan-400/80">
              <span>WASM EVAL: 0.12ms</span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400">60 FPS</span>
            </div>
          </div>

          {/* Actual Vinculum Editor Screenshot */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#070b16]">
            <img
              src={staticFile("landing/editor-dark.jpg")}
              alt="Vinculum Interactive Workspace"
              className="w-full h-full object-cover object-left-top"
            />
            {/* Subtle inner reflection gradient */}
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-blue-500/5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 4. Brand Reveal Typography (Anchored Over Workspace) */}
      <div
        className="absolute z-30 flex flex-col items-center text-center pointer-events-none"
        style={{
          bottom: isVertical ? "12%" : "8%",
          opacity: brandOpacity,
          transform: `translateY(${brandY}px)`,
        }}
      >
        <div className="flex items-center gap-3">
          <img
            src={staticFile("brand/logo_only.png")}
            alt="Vinculum Logo"
            className="w-9 h-9 object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.8)]"
          />
          <h1 className="text-4xl md:text-5xl font-black tracking-wider text-white">
            VINCULUM
          </h1>
        </div>
        <p className="mt-2 text-sm md:text-base font-light text-cyan-200/90 tracking-wide">
          See the beauty in every equation.
        </p>
      </div>
    </div>
  );
};
