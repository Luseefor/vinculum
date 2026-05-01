"use client";

import { Graph2DCanvas, type Graph2DCanvasVariant } from "@/components/graph/Graph2DCanvas";

interface Viewport2DProps {
  className?: string;
  variant?: Graph2DCanvasVariant;
}

export default function Viewport2D({ className, variant = "primary" }: Viewport2DProps) {
  return <Graph2DCanvas className={className} variant={variant} />;
}
