import React, { useMemo } from "react";
import katex from "katex";
import { useCurrentFrame, spring, useVideoConfig } from "remotion";

interface FormulaCardProps {
  latex: string;
  label?: string;
  badge?: string;
  glowColor?: "blue" | "cyan" | "purple" | "amber";
  className?: string;
  delay?: number;
  parameters?: Record<string, string | number>;
}

export const FormulaCard: React.FC<FormulaCardProps> = ({
  latex,
  label = "Equation",
  badge,
  glowColor = "cyan",
  className = "",
  delay = 0,
  parameters,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const renderedLatex = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return latex;
    }
  }, [latex]);

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  const glowShadowMap = {
    blue: "rgba(59, 130, 246, 0.3)",
    cyan: "rgba(6, 182, 212, 0.35)",
    purple: "rgba(168, 85, 247, 0.35)",
    amber: "rgba(245, 158, 11, 0.35)",
  };

  return (
    <div
      className={`glass-panel rounded-2xl p-5 border border-white/15 ${className}`}
      style={{
        transform: `scale(${scale})`,
        opacity: scale,
        boxShadow: `0 15px 35px -5px ${glowShadowMap[glowColor]}, 0 0 1px 1px rgba(255,255,255,0.1)`,
      }}
    >
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-xs uppercase tracking-widest text-slate-400 font-mono">
            {label}
          </span>
        </div>
        {badge && (
          <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-cyan-300 text-xs font-mono">
            {badge}
          </span>
        )}
      </div>

      <div
        className="py-2 text-white font-serif text-xl md:text-2xl text-center flex justify-center items-center overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: renderedLatex }}
      />

      {parameters && Object.keys(parameters).length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-3 justify-center text-xs font-mono text-slate-300">
          {Object.entries(parameters).map(([key, val]) => (
            <div key={key} className="bg-slate-800/80 px-2.5 py-1 rounded border border-white/5">
              <span className="text-cyan-400">{key}:</span> {val}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
