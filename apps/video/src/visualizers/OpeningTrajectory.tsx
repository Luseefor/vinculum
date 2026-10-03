import React, { useRef, useEffect } from "react";
import { interpolate } from "remotion";

interface OpeningTrajectoryProps {
  frame: number;
  width?: number;
  height?: number;
}

/**
 * OpeningTrajectory
 * Macro math curve tracing point r(t) = (cos t, sin t, t/3) with tangent vector T(t),
 * coordinate velocity telemetry, and projection onto the coordinate plane.
 */
export const OpeningTrajectory: React.FC<OpeningTrajectoryProps> = ({
  frame,
  width = 1920,
  height = 1080,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Progressive parameter sweep from t = 0 to 4.5
  const tProgress = interpolate(frame, [0, 95], [0.1, 4.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const scale = 240;

    // Projection helper
    const project = (x: number, y: number, z: number) => {
      // 3D coordinate transform with subtle perspective
      const cosA = Math.cos(0.55);
      const sinA = Math.sin(0.55);
      const rx = x * cosA - y * sinA;
      const ry = (x * sinA + y * cosA) * 0.55 - z * 0.75;
      return {
        px: cx + rx * scale,
        py: cy + ry * scale,
      };
    };

    // 1. Draw Subtle Mathematical Coordinate Plane
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(56, 189, 248, 0.12)";
    for (let i = -3; i <= 3; i += 0.75) {
      const p1 = project(-3, i, 0);
      const p2 = project(3, i, 0);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();

      const q1 = project(i, -3, 0);
      const q2 = project(i, 3, 0);
      ctx.beginPath();
      ctx.moveTo(q1.px, q1.py);
      ctx.lineTo(q2.px, q2.py);
      ctx.stroke();
    }

    // 2. Trace the Active Parametric Space Curve
    const steps = 180;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";

    const gradient = ctx.createLinearGradient(cx - 300, cy, cx + 300, cy);
    gradient.addColorStop(0, "rgba(59, 130, 246, 0.2)");
    gradient.addColorStop(0.7, "rgba(6, 182, 212, 0.9)");
    gradient.addColorStop(1, "#38bdf8");
    ctx.strokeStyle = gradient;

    ctx.beginPath();
    let currentHead = { px: cx, py: cy, x: 0, y: 0, z: 0 };

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * tProgress;
      const x = Math.cos(t * 1.5) * 1.4;
      const y = Math.sin(t * 1.5) * 1.4;
      const z = (t * 1.5) / 3 - 0.9;
      const pt = project(x, y, z);

      if (i === 0) {
        ctx.moveTo(pt.px, pt.py);
      } else {
        ctx.lineTo(pt.px, pt.py);
      }

      if (i === steps) {
        currentHead = { px: pt.px, py: pt.py, x, y, z };
      }
    }
    ctx.stroke();

    // 3. Drop Shadow / Projection onto Plane
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(6, 182, 212, 0.18)";
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * tProgress;
      const x = Math.cos(t * 1.5) * 1.4;
      const y = Math.sin(t * 1.5) * 1.4;
      const pt = project(x, y, 0);
      if (i === 0) ctx.moveTo(pt.px, pt.py);
      else ctx.lineTo(pt.px, pt.py);
    }
    ctx.stroke();

    // 4. Draw Tangent Velocity Vector T(t) at Head Point
    const t = tProgress;
    const dx = -Math.sin(t * 1.5) * 1.5 * 1.4;
    const dy = Math.cos(t * 1.5) * 1.5 * 1.4;
    const dz = 1.5 / 3;
    const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const tx = dx / mag;
    const ty = dy / mag;
    const tz = dz / mag;

    const tangentEnd = project(
      currentHead.x + tx * 0.6,
      currentHead.y + ty * 0.6,
      currentHead.z + tz * 0.6
    );

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#fb7185"; // Rose tangent vector
    ctx.beginPath();
    ctx.moveTo(currentHead.px, currentHead.py);
    ctx.lineTo(tangentEnd.px, tangentEnd.py);
    ctx.stroke();

    // Tangent Arrowhead
    const angle = Math.atan2(
      tangentEnd.py - currentHead.py,
      tangentEnd.px - currentHead.px
    );
    ctx.fillStyle = "#fb7185";
    ctx.beginPath();
    ctx.moveTo(tangentEnd.px, tangentEnd.py);
    ctx.lineTo(
      tangentEnd.px - 10 * Math.cos(angle - Math.PI / 6),
      tangentEnd.py - 10 * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      tangentEnd.px - 10 * Math.cos(angle + Math.PI / 6),
      tangentEnd.py - 10 * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    // 5. Draw Glowing Tracing Head Point
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(currentHead.px, currentHead.py, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0; // reset
  }, [frame, tProgress, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
    />
  );
};
