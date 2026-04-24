"use client";

import { Graph2DCanvas } from "@/components/graph/Graph2DCanvas";

interface Viewport2DProps {
  className?: string;
}

export default function Viewport2D({ className }: Viewport2DProps) {
  return <Graph2DCanvas className={className} />;
}
