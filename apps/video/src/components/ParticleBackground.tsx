import React, { useMemo } from "react";
import { useCurrentFrame, interpolate } from "remotion";

interface ParticleBackgroundProps {
  intensity?: number;
  gridOpacity?: number;
}

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  intensity = 1,
  gridOpacity = 0.25,
}) => {
  const frame = useCurrentFrame();

  const particles = useMemo(() => {
    const list = [];
    for (let i = 0; i < 45; i++) {
      const x = (i * 97) % 1920;
      const y = (i * 137) % 1080;
      const size = (i % 4) + 1.5;
      const speed = 0.3 + (i % 5) * 0.15;
      const alpha = 0.2 + (i % 6) * 0.12;
      const color =
        i % 3 === 0
          ? "rgba(59, 130, 246,"
          : i % 3 === 1
          ? "rgba(6, 182, 212,"
          : "rgba(139, 92, 246,";
      list.push({ x, y, size, speed, alpha, color });
    }
    return list;
  }, []);

  const gridOffset = (frame * 0.5) % 80;
  const pulse = Math.sin(frame * 0.05) * 0.15 + 0.85;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-[#050814]">
      {/* Radial ambient lighting */}
      <div
        className="absolute top-1/4 left-1/3 w-[800px] h-[800px] rounded-full filter blur-[140px] opacity-25"
        style={{
          background:
            "radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(6, 182, 212, 0.15) 50%, transparent 70%)",
          transform: `scale(${pulse}) translate(${Math.sin(frame * 0.02) * 40}px, ${
            Math.cos(frame * 0.02) * 30
          }px)`,
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[700px] h-[700px] rounded-full filter blur-[130px] opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, rgba(244, 63, 94, 0.1) 50%, transparent 70%)",
          transform: `scale(${1.2 - pulse * 0.2}) translate(${
            -Math.cos(frame * 0.02) * 40
          }px, ${-Math.sin(frame * 0.02) * 30}px)`,
        }}
      />

      {/* Isometric/perspective grid pattern */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ opacity: gridOpacity * intensity }}
      >
        <defs>
          <pattern
            id="math-grid-pattern"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(0, ${gridOffset})`}
          >
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="1"
            />
            <circle cx="0" cy="0" r="1.5" fill="rgba(59, 130, 246, 0.4)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#math-grid-pattern)" />
      </svg>

      {/* Floating particles */}
      {particles.map((p, idx) => {
        const currentY = (p.y - frame * p.speed + 1200) % 1200 - 50;
        const currentX = p.x + Math.sin((frame + idx * 20) * 0.02) * 15;
        const opacity = interpolate(
          currentY,
          [0, 200, 900, 1100],
          [0, p.alpha * intensity, p.alpha * intensity, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        return (
          <div
            key={idx}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${currentX}px`,
              top: `${currentY}px`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: `${p.color} ${opacity})`,
              boxShadow: `0 0 ${p.size * 3}px ${p.color} ${opacity * 0.8})`,
            }}
          />
        );
      })}
    </div>
  );
};
