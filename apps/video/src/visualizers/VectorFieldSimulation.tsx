import React, { useRef, useEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";

interface VectorFieldSimulationProps {
  width?: number;
  height?: number;
}

export const VectorFieldSimulation: React.FC<VectorFieldSimulationProps> = ({
  width = 800,
  height = 550,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frame = useCurrentFrame();

  // Create stream particles with persistent initial states
  const particleSeeds = useMemo(() => {
    const list = [];
    for (let i = 0; i < 220; i++) {
      list.push({
        origX: (Math.sin(i * 99.1) * 0.5 + 0.5) * 6 - 3,
        origY: (Math.cos(i * 47.3) * 0.5 + 0.5) * 6 - 3,
        lifeSpan: 60 + (i % 40),
        offset: i * 7,
        hue: i % 2 === 0 ? "#38bdf8" : "#818cf8",
      });
    }
    return list;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const scale = Math.min(width, height) / 8;
    const cx = width / 2;
    const cy = height / 2;

    const toScreenX = (x: number) => cx + x * scale;
    const toScreenY = (y: number) => cy - y * scale;

    // Mathematical vector field equation: F(x, y) = (-y + 0.2*sin(t), x - 0.1*cos(t))
    const t = frame * 0.03;
    const field = (x: number, y: number) => {
      const vx = -Math.sin(y * 0.8) - 0.3 * Math.sin(t) * x;
      const vy = Math.sin(x * 0.8) + 0.3 * Math.cos(t) * y;
      const len = Math.hypot(vx, vy) || 0.001;
      return { vx, vy, normVx: vx / len, normVy: vy / len, len };
    };

    // 1. Draw static grid of directional arrows
    const gridCols = 14;
    const gridRows = 10;
    const xStep = 6 / gridCols;
    const yStep = 4.5 / gridRows;

    ctx.lineWidth = 1.2;
    for (let i = 0; i <= gridCols; i++) {
      const gx = -3 + i * xStep;
      for (let j = 0; j <= gridRows; j++) {
        const gy = -2.25 + j * yStep;
        const { normVx, normVy, len } = field(gx, gy);

        const sx = toScreenX(gx);
        const sy = toScreenY(gy);
        const arrowLen = Math.min(18, 8 + len * 8);

        const ex = sx + normVx * arrowLen;
        const ey = sy - normVy * arrowLen;

        ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Arrow head dot
        ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
        ctx.beginPath();
        ctx.arc(ex, ey, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Animate streamline tracing particles
    particleSeeds.forEach((seed) => {
      const localAge = (frame + seed.offset) % seed.lifeSpan;
      const dt = 0.04;
      let px = seed.origX;
      let py = seed.origY;

      // Integrate forward with Runge-Kutta 2 / Euler
      ctx.beginPath();
      let first = true;
      const trailLength = Math.min(18, localAge);

      for (let step = 0; step < localAge; step++) {
        const { vx, vy } = field(px, py);
        px += vx * dt;
        py += vy * dt;

        if (step >= localAge - trailLength) {
          const scrX = toScreenX(px);
          const scrY = toScreenY(py);
          if (first) {
            ctx.moveTo(scrX, scrY);
            first = false;
          } else {
            ctx.lineTo(scrX, scrY);
          }
        }
      }

      const lifeRatio = localAge / seed.lifeSpan;
      const alpha = Math.sin(lifeRatio * Math.PI) * 0.85;

      ctx.strokeStyle = seed.hue;
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha;
      ctx.stroke();

      // Head point
      const scrX = toScreenX(px);
      const scrY = toScreenY(py);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(scrX, scrY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1.0;
  }, [frame, width, height, particleSeeds]);

  return (
    <div className="relative flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-2xl"
      />
    </div>
  );
};
