import React from "react";
import { interpolate, staticFile, Video } from "remotion";
import katex from "katex";

interface Shot5Props {
  frame: number; // local frame (0 - 90 / 3.0s)
}

/**
 * Shot 5: Real Surface Behavior (8.5s - 11.5s / 90 frames)
 *
 * Real Engine Rendering:
 * - Direct cut to real Vinculum Saddle Surface (Hyperbolic Paraboloid z = (x^2 - y^2)/2).
 * - Real product material: MeshStandardMaterial illuminated by Three.js directional and hemisphere lights.
 * - Subtle real wireframe edge overlay (LineSegments) and real baseline grid.
 * - Minimal typography: "02 / DIFFERENTIAL SURFACES" + formula.
 */
export const Shot5Surfaces: React.FC<Shot5Props> = ({ frame }) => {
  const formulaOpacity = interpolate(frame, [0, 8, 80], [0, 1, 0.88], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const formulaHtml = katex.renderToString(
    "z = \\frac{x^2 - y^2}{2}",
    { displayMode: false, throwOnError: false }
  );

  return (
    <div className="absolute inset-0 select-none overflow-hidden bg-[#050811]">
      {/* 1. Real Vinculum 3D Engine Surface (Full Screen Footage) */}
      <div className="absolute inset-0 w-full h-full">
        <Video
          src={staticFile("recorded/clip-saddle-orbit.mp4")}
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* 2. Focused Editorial Top Bar */}
      <div className="absolute top-12 left-20 right-20 flex items-start justify-between z-10 pointer-events-none">
        {/* Left: Monospace Label + Settled Equation */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] tracking-widest text-slate-400 uppercase">
            02 / Differential Surfaces
          </span>
          <div
            dangerouslySetInnerHTML={{ __html: formulaHtml }}
            className="text-white text-xl font-light tracking-wide origin-top-left"
            style={{ opacity: formulaOpacity }}
          />
        </div>

        {/* Right: Real Engine Signature */}
        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          <span>Explicit Surface Mesh</span>
        </div>
      </div>
    </div>
  );
};
