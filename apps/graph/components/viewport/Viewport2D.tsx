"use client";

import { Graph2DCanvas, type Graph2DCanvasVariant } from "@/components/graph/Graph2DCanvas";

interface Viewport2DProps {
  className?: string;
  variant?: Graph2DCanvasVariant;
  suspended?: boolean;
}

export default function Viewport2D({ className, variant = "primary", suspended = false }: Viewport2DProps) {
  return <Graph2DCanvas className={className} variant={variant} suspended={suspended} />;
}
