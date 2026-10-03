import React from "react";
import { interpolate } from "remotion";
import { EASINGS } from "./prototypeTimeline";

interface Shot1Props {
  frame: number; // local frame (0 - 42 / 1.4s)
}

/**
 * Shot 1: The Hook Statement (0.0s - 1.4s / 42 frames)
 * Snappy, confident entry and exit:
 * "Mathematics"
 * "shouldn't feel flat."
 */
export const Shot1Hook: React.FC<Shot1Props> = ({ frame }) => {
  // Line 1: "Mathematics" enters promptly (frames 2 - 16)
  const line1Progress = EASINGS.outExpo(
    interpolate(frame, [2, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  const line1Opacity = interpolate(frame, [2, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line1Y = interpolate(line1Progress, [0, 1], [18, 0]);

  // Line 2: "shouldn't feel flat." enters right behind (frames 12 - 24)
  const line2Progress = EASINGS.outExpo(
    interpolate(frame, [12, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  const line2Opacity = interpolate(frame, [12, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line2Y = interpolate(line2Progress, [0, 1], [18, 0]);

  // "flat." color shift: white -> vibrant cyan (frames 22 - 32)
  const flatColorProgress = interpolate(frame, [22, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Snappy cut directly into brand mark (frames 37 - 42)
  const exitOpacity = interpolate(frame, [37, 42], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center select-none"
      style={{ opacity: exitOpacity }}
    >
      <div className="flex flex-col items-center text-center font-sans tracking-tight">
        {/* Line 1 */}
        <div
          className="text-6xl md:text-7xl font-bold text-slate-100"
          style={{
            opacity: line1Opacity,
            transform: `translateY(${line1Y}px)`,
          }}
        >
          Mathematics
        </div>

        {/* Line 2 */}
        <div
          className="mt-3 text-5xl md:text-6xl font-normal text-slate-300 flex items-center gap-3"
          style={{
            opacity: line2Opacity,
            transform: `translateY(${line2Y}px)`,
          }}
        >
          <span>shouldn&apos;t feel</span>
          <span
            className="font-semibold transition-colors duration-200"
            style={{
              color: flatColorProgress > 0 ? "#38bdf8" : "#f1f5f9",
              textShadow:
                flatColorProgress > 0
                  ? `0 0 ${flatColorProgress * 28}px rgba(56, 189, 248, ${flatColorProgress * 0.6})`
                  : "none",
            }}
          >
            flat.
          </span>
        </div>
      </div>
    </div>
  );
};
