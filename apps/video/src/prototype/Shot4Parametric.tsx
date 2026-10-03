import React from "react";
import { interpolate, staticFile, Video } from "remotion";
import katex from "katex";

interface Shot4Props {
  frame: number; // local frame (0 - 90 / 3.0s)
}

/**
 * Shot 4: Real Parametric Behavior (5.5s - 8.5s / 90 frames)
 *
 * Real Engine Rendering:
 * - Match cut from the editor's 3D viewport directly into the full-frame Vinculum canvas.
 * - Displays the real product's Three.js scene: real wide-stroke ribbon, real 3D axes, real adaptive grid.
 * - Real camera orbit around the geometry.
 * - Minimal typography: "01 / PARAMETRIC CURVES" + formula r(t).
 */
export const Shot4Parametric: React.FC<Shot4Props> = ({ frame }) => {
  // Settle formula opacity (frames 0 - 10)
  const formulaOpacity = interpolate(frame, [0, 8, 80], [0, 1, 0.88], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const formulaHtml = katex.renderToString(
    "\\mathbf{r}(t) = \\begin{pmatrix} \\cos(t) \\\\ \\sin(t) \\\\ t/3 \\end{pmatrix}",
    { displayMode: false, throwOnError: false }
  );

  return (
    <div className="absolute inset-0 select-none overflow-hidden bg-[#050811]">
      {/* 1. Real Vinculum 3D Engine Canvas (Full Screen Footage) */}
      <div className="absolute inset-0 w-full h-full">
        <Video
          src={staticFile("recorded/clip-helix-orbit.mp4")}
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* 2. Focused Editorial Top Bar */}
      <div className="absolute top-12 left-20 right-20 flex items-start justify-between z-10 pointer-events-none">
        {/* Left: Monospace Label + Settled Equation */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] tracking-widest text-slate-400 uppercase">
            01 / Parametric Curves
          </span>
          <div
            dangerouslySetInnerHTML={{ __html: formulaHtml }}
            className="text-white text-xl font-light tracking-wide origin-top-left"
            style={{ opacity: formulaOpacity }}
          />
        </div>

        {/* Right: Real Engine Signature */}
        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>Real-time 3D Canvas</span>
        </div>
      </div>
    </div>
  );
};
