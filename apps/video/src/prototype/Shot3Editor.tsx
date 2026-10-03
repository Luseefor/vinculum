import React from "react";
import { interpolate, staticFile, Video } from "remotion";
import { EASINGS } from "./prototypeTimeline";

interface Shot3Props {
  frame: number; // local frame (0 - 96 / 3.2s)
}

/**
 * Shot 3: Real Product Interaction (2.3s - 5.5s / 96 frames)
 *
 * Real Event Progression:
 * 0.0s (frame 0): Real Vinculum workspace appears with 2D+3D view.
 * 0.8s (frame 24): User triggers Scene menu -> Open example -> Helix Curve.
 * 1.8s (frame 54): Graph instantly responds: parametric curve renders in the actual 3D engine.
 * 2.6s (frame 78): Directed camera push focuses into the active 3D canvas for the match cut.
 */
export const Shot3Editor: React.FC<Shot3Props> = ({ frame }) => {
  // Settle entrance (frames 0 - 15)
  const entrance = EASINGS.outExpo(
    interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Phase 1: Stable contemplation while interaction occurs (frames 0 - 72)
  // Phase 2: Directed zoom into the 3D viewport on final frames (frames 72 - 96)
  const transitionPush = EASINGS.outExpo(
    interpolate(frame, [72, 96], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );

  const scale = interpolate(entrance, [0, 1], [0.96, 1.0]) + transitionPush * 0.32;
  const panX = interpolate(transitionPush, [0, 1], [0, -70]);
  const panY = interpolate(transitionPush, [0, 1], [0, -25]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center select-none overflow-hidden">
      {/* 1. Large Real Vinculum Interface Window */}
      <div
        className="relative z-10 w-[84%] max-w-[1540px] rounded-xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_50px_rgba(6,182,212,0.12)] border border-white/10 bg-[#070b16] origin-[62%_55%]"
        style={{
          opacity,
          transform: `scale(${scale}) translate3d(${panX}px, ${panY}px, 0)`,
        }}
      >
        {/* Real macOS Window Titlebar */}
        <div className="h-9 bg-[#090e1a] px-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block" />
            <span className="ml-3 font-mono text-xs text-slate-400">
              vinculum.math / math-lab-3d
            </span>
          </div>

          <div className="flex items-center gap-4 font-mono text-xs text-slate-400">
            <span className="text-cyan-400">WebAssembly Core</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400">60 FPS</span>
          </div>
        </div>

        {/* Real Product Video Footage: Exact Interaction */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#070b16]">
          <Video
            src={staticFile("recorded/clip-editor-interaction.mp4")}
            className="w-full h-full object-cover object-center"
          />
        </div>
      </div>
    </div>
  );
};
