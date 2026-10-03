import React, { useRef, useEffect } from "react";
import { useCurrentFrame } from "remotion";

interface SurfaceMesh3DProps {
  width?: number;
  height?: number;
  resolution?: number;
  wireframeOnly?: boolean;
}

export const SurfaceMesh3D: React.FC<SurfaceMesh3DProps> = ({
  width = 800,
  height = 550,
  resolution = 24,
  wireframeOnly = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frame = useCurrentFrame();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const time = frame * 0.04;
    const pitch = 0.55 + Math.sin(time * 0.3) * 0.08;
    const yaw = frame * 0.015;
    const fov = 480;
    const cx = width / 2;
    const cy = height / 2 + 30;

    const project = (x: number, y: number, z: number) => {
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;

      const cosX = Math.cos(pitch);
      const sinX = Math.sin(pitch);
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      const depth = z2 + 380;
      if (depth <= 20) return null;

      const scale = fov / depth;
      return {
        px: cx + x1 * scale,
        py: cy - y2 * scale,
        depth,
        x,
        y,
        z,
      };
    };

    // Calculate grid vertices: z = sin(x)*cos(y)
    const span = 140;
    const step = span / resolution;
    const grid: ({ px: number; py: number; depth: number; yVal: number } | null)[][] = [];

    for (let i = 0; i <= resolution; i++) {
      grid[i] = [];
      const x = -span / 2 + i * step;
      const normX = (x / span) * Math.PI * 2;

      for (let j = 0; j <= resolution; j++) {
        const z = -span / 2 + j * step;
        const normZ = (z / span) * Math.PI * 2;

        // Mathematical equation with harmonic wave evolution
        const wave =
          Math.sin(normX * 1.5 + time) * Math.cos(normZ * 1.5 + time * 0.7) * 45 +
          Math.sin(normX * 0.8 - time * 0.5) * 15;

        const proj = project(x, wave, z);
        grid[i][j] = proj ? { ...proj, yVal: wave } : null;
      }
    }

    // Build faces (quads) and depth-sort them
    interface Face {
      pts: { px: number; py: number }[];
      avgDepth: number;
      avgY: number;
    }

    const faces: Face[] = [];

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const p00 = grid[i][j];
        const p10 = grid[i + 1][j];
        const p11 = grid[i + 1][j + 1];
        const p01 = grid[i][j + 1];

        if (p00 && p10 && p11 && p01) {
          const avgDepth = (p00.depth + p10.depth + p11.depth + p01.depth) / 4;
          const avgY = (p00.yVal + p10.yVal + p11.yVal + p01.yVal) / 4;
          faces.push({
            pts: [p00, p10, p11, p01],
            avgDepth,
            avgY,
          });
        }
      }
    }

    // Painter's algorithm: sort faces from back to front
    faces.sort((a, b) => b.avgDepth - a.avgDepth);

    // Render faces
    faces.forEach((face) => {
      ctx.beginPath();
      ctx.moveTo(face.pts[0].px, face.pts[0].py);
      ctx.lineTo(face.pts[1].px, face.pts[1].py);
      ctx.lineTo(face.pts[2].px, face.pts[2].py);
      ctx.lineTo(face.pts[3].px, face.pts[3].py);
      ctx.closePath();

      if (!wireframeOnly) {
        // Dynamic gradient based on height (avgY)
        // High = cyan/blue, Low = purple/indigo
        const normalizedY = Math.max(0, Math.min(1, (face.avgY + 50) / 100));
        const r = Math.floor(56 + normalizedY * 50);
        const g = Math.floor(100 + normalizedY * 110);
        const b = Math.floor(220 + normalizedY * 35);
        const alpha = 0.55 + normalizedY * 0.35;

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();
      }

      // Wireframe outline
      ctx.strokeStyle = wireframeOnly
        ? "rgba(56, 189, 248, 0.7)"
        : "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = wireframeOnly ? 1.2 : 0.8;
      ctx.stroke();
    });

    // Draw glowing horizon highlight
    ctx.save();
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 25;
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= resolution; i++) {
      const pt = grid[i][Math.floor(resolution / 2)];
      if (pt) {
        if (i === 0) ctx.moveTo(pt.px, pt.py);
        else ctx.lineTo(pt.px, pt.py);
      }
    }
    ctx.stroke();
    ctx.restore();
  }, [frame, width, height, resolution, wireframeOnly]);

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
