import React from "react";

interface GlowBadgeProps {
  label: string;
  icon?: React.ReactNode;
  color?: "blue" | "cyan" | "purple" | "emerald" | "amber";
  className?: string;
}

export const GlowBadge: React.FC<GlowBadgeProps> = ({
  label,
  icon,
  color = "blue",
  className = "",
}) => {
  const colorMap = {
    blue: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-blue-400",
      glow: "shadow-[0_0_15px_rgba(59,130,246,0.3)]",
      dot: "bg-blue-400",
    },
    cyan: {
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      text: "text-cyan-400",
      glow: "shadow-[0_0_15px_rgba(6,182,212,0.3)]",
      dot: "bg-cyan-400",
    },
    purple: {
      bg: "bg-purple-500/10",
      border: "border-purple-500/30",
      text: "text-purple-400",
      glow: "shadow-[0_0_15px_rgba(168,85,247,0.3)]",
      dot: "bg-purple-400",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-400",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.3)]",
      dot: "bg-emerald-400",
    },
    amber: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-400",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.3)]",
      dot: "bg-amber-400",
    },
  };

  const current = colorMap[color];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border backdrop-blur-md ${current.bg} ${current.border} ${current.text} ${current.glow} ${className}`}
    >
      <span className={`w-2 h-2 rounded-full ${current.dot} animate-pulse`} />
      {icon && <span className="text-sm">{icon}</span>}
      <span className="text-xs font-semibold tracking-wider uppercase font-mono">
        {label}
      </span>
    </div>
  );
};
