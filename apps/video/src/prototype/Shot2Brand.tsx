import React from "react";
import { interpolate, staticFile } from "remotion";
import { EASINGS } from "./prototypeTimeline";

interface Shot2Props {
  frame: number; // local frame (0 - 27 / 0.9s)
}

/**
 * Shot 2: Brand Mark & Tagline (1.4s - 2.3s / 27 frames)
 * Fast, confident identity punctuation.
 * Direct on clean dark canvas. No delay.
 */
export const Shot2Brand: React.FC<Shot2Props> = ({ frame }) => {
  // Settle animation (frames 0 - 12)
  const entrance = EASINGS.outExpo(
    interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(entrance, [0, 1], [0.95, 1.0]);

  // Tagline enters alongside
  const tagOpacity = interpolate(frame, [6, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Clean cut directly into product editor (frames 23 - 27)
  const exitOpacity = interpolate(frame, [23, 27], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center select-none"
      style={{
        opacity: opacity * exitOpacity,
        transform: `scale(${scale})`,
      }}
    >
      <div className="flex items-center gap-4">
        <img
          src={staticFile("brand/logo_only.png")}
          alt="Vinculum Logo"
          className="w-14 h-14 object-contain drop-shadow-[0_0_20px_rgba(56,189,248,0.45)]"
        />
        <h1 className="text-6xl font-black tracking-wider text-white">
          VINCULUM
        </h1>
      </div>

      <p
        className="mt-3 text-lg font-light text-slate-400 tracking-wide"
        style={{ opacity: tagOpacity }}
      >
        See equations with depth.
      </p>
    </div>
  );
};
