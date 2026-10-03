import React, { useRef, useEffect } from "react";
import { useCurrentFrame } from "remotion";

interface ParametricHelix3DProps {
  width?: number;
  height?: number;
  color?: string;
  glowColor?: string;
  revolutions?: number;
  speed?: number;
}

export const ParametricHelix3D: React.FC<ParametricHelix3DProps> = ({
  width = 800,
  height = 550,
  color = "#38bdf8",
  glowColor = "rgba(56, 189, 248, 0.4)",
  revolutions = 4,
  speed = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frame = useCurrentFrame();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Camera parameters
    const angleX = 0.45 + Math.sin(frame * 0.015 * speed) * 0.15; // pitch
    const angleY = frame * 0.02 * speed; // yaw rotation
    const fov = 420;
    const cx = width / 2;
    const cy = height / 2;

    // 3D rotation projection helper
    const project = (x: number, y: number, z: number) => {
      // Rotate around Y axis
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;

      // Rotate around X axis
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      const depth = z2 + 350;
      if (depth <= 10) return null;

      const scale = fov / depth;
      return {
        px: cx + x1 * scale,
        py: cy - y2 * scale, // invert Y for canvas
        depth,
        scale,
      };
    };

    // 1. Draw 3D Base Grid
    const gridSize = 140;
    const gridStep = 28;
    ctx.lineWidth = 1;

    for (let g = -gridSize; g <= gridSize; g += gridStep) {
      // Lines parallel to X
      const p1 = project(-gridSize, -60, g);
      const p2 = project(gridSize, -60, g);
      if (p1 && p2) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }

      // Lines parallel to Z
      const p3 = project(g, -60, -gridSize);
      const p4 = project(g, -60, gridSize);
      if (p3 && p4) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.beginPath();
        ctx.moveTo(p3.px, p3.py);
        ctx.lineTo(p4.px, p4.py);
        ctx.stroke();
      }
    }

    // 2. Draw 3D Axes
    const origin = project(0, -60, 0);
    const axisX = project(gridSize * 1.1, -60, 0);
    const axisY = project(0, 100, 0);
    const axisZ = project(0, -60, gridSize * 1.1);

    if (origin && axisX && axisY && axisZ) {
      // X axis - Red
      ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
      ctx.beginPath();
      ctx.moveTo(origin.px, origin.py);
      ctx.lineTo(axisX.px, axisX.py);
      ctx.stroke();

      // Y axis - Green (Up)
      ctx.strokeStyle = "rgba(34, 197, 94, 0.6)";
      ctx.beginPath();
      ctx.moveTo(origin.px, origin.py);
      ctx.lineTo(axisY.px, axisY.py);
      ctx.stroke();

      // Z axis - Blue
      ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
      ctx.beginPath();
      ctx.moveTo(origin.px, origin.py);
      ctx.lineTo(axisZ.px, axisZ.py);
      ctx.stroke();
    }

    // 3. Draw Helix Curve
    const R = 85;
    const heightSpan = 150;
    const totalPoints = 300;
    const maxT = Math.PI * 2 * revolutions;
    // Animate helix growth from frame 0 to 45
    const growthProgress = Math.min(1, Math.max(0, frame / 40));
    const activePointsCount = Math.floor(totalPoints * growthProgress);

    const projectedPoints: { px: number; py: number; depth: number }[] = [];

    for (let i = 0; i <= activePointsCount; i++) {
      const t = (i / totalPoints) * maxT;
      const x = R * Math.cos(t);
      const z = R * Math.sin(t);
      const y = -60 + (i / totalPoints) * heightSpan;

      const pt = project(x, y, z);
      if (pt) {
        projectedPoints.push(pt);
      }
    }

    // Draw glowing glow layer
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    projectedPoints.forEach((pt, index) => {
      if (index === 0) ctx.moveTo(pt.px, pt.py);
      else ctx.lineTo(pt.px, pt.py);
    });
    ctx.stroke();
    ctx.restore();

    // Sharp core curve line
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    projectedPoints.forEach((pt, index) => {
      if (index === 0) ctx.moveTo(pt.px, pt.py);
      else ctx.lineTo(pt.px, pt.py);
    });
    ctx.stroke();

    // 4. Moving Tracer Particle & Tangent Vector along the Helix
    if (activePointsCount > 5) {
      const traceT = ((frame * 0.03 * speed) % 1) * maxT;
      const tx = R * Math.cos(traceT);
      const tz = R * Math.sin(traceT);
      const ty = -60 + (traceT / maxT) * heightSpan;

      // Derivative (Tangent)
      const dtx = -R * Math.sin(traceT);
      const dtz = R * Math.cos(traceT);
      const dty = heightSpan / maxT;
      const tLen = Math.hypot(dtx, dty, dtz);

      const tracerPt = project(tx, ty, tz);
      const tangentEndPt = project(
        tx + (dtx / tLen) * 35,
        ty + (dty / tLen) * 35,
        tz + (dtz / tLen) * 35
      );

      if (tracerPt) {
        // Glowing tracer sphere
        const grad = ctx.createRadialGradient(
          tracerPt.px,
          tracerPt.py,
          0,
          tracerPt.px,
          tracerPt.py,
          14
        );
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.3, "#38bdf8");
        grad.addColorStop(1, "rgba(56, 189, 248, 0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(tracerPt.px, tracerPt.py, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(tracerPt.px, tracerPt.py, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Tangent vector arrow
        if (tangentEndPt) {
          ctx.strokeStyle = "#f59e0b"; // Gold tangent vector
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(tracerPt.px, tracerPt.py);
          ctx.lineTo(tangentEndPt.px, tangentEndPt.py);
          ctx.stroke();

          // Vector tip badge
          ctx.fillStyle = "#f59e0b";
          ctx.font = "bold 10px monospace";
          ctx.fillText("T(t)", tangentEndPt.px + 4, tangentEndPt.py - 4);
        }
      }
    }
  }, [frame, width, height, color, glowColor, revolutions, speed]);

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
