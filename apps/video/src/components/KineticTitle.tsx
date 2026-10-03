import React from "react";
import { useCurrentFrame, spring, useVideoConfig } from "remotion";

interface KineticTitleProps {
  title: string;
  subtitle?: string;
  highlightWords?: string[];
  highlightColor?: "cyan" | "purple" | "blue" | "gold";
  align?: "left" | "center" | "right";
  className?: string;
  delay?: number;
}

export const KineticTitle: React.FC<KineticTitleProps> = ({
  title,
  subtitle,
  highlightWords = [],
  highlightColor = "cyan",
  align = "center",
  className = "",
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = title.split(" ");

  const colorClassMap = {
    cyan: "text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-400 drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]",
    purple:
      "text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-300 to-indigo-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.6)]",
    blue: "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]",
    gold: "text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]",
  };

  const alignClass =
    align === "center"
      ? "text-center items-center"
      : align === "right"
      ? "text-right items-end"
      : "text-left items-start";

  const subtitleProgress = spring({
    frame: frame - delay - 12,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  return (
    <div className={`flex flex-col ${alignClass} ${className}`}>
      <h1 className="flex flex-wrap gap-x-3 gap-y-1 justify-center font-bold tracking-tight text-4xl md:text-5xl lg:text-6xl text-white">
        {words.map((word, i) => {
          const isHighlighted = highlightWords.some(
            (hw) => word.toLowerCase().includes(hw.toLowerCase())
          );
          const wordProgress = spring({
            frame: frame - delay - i * 3,
            fps,
            config: { damping: 12, stiffness: 100 },
          });

          const translateY = (1 - wordProgress) * 35;
          const opacity = wordProgress;

          return (
            <span
              key={i}
              className={`inline-block transition-transform ${
                isHighlighted ? colorClassMap[highlightColor] : "text-white"
              }`}
              style={{
                transform: `translateY(${translateY}px)`,
                opacity,
              }}
            >
              {word}
            </span>
          );
        })}
      </h1>

      {subtitle && (
        <p
          className="mt-4 text-lg md:text-xl lg:text-2xl text-slate-400 font-light max-w-2xl leading-relaxed"
          style={{
            transform: `translateY(${(1 - subtitleProgress) * 20}px)`,
            opacity: subtitleProgress,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};
