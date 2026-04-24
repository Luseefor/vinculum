"use client";

import dynamic from "next/dynamic";

const Graph3DCanvas = dynamic(() => import("@/components/graph/GraphCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-[11px] text-[var(--text-tertiary)]">
      Loading 3D view…
    </div>
  )
});

interface Viewport3DProps {
  className?: string;
}

export default function Viewport3D({ className = "" }: Viewport3DProps) {
  return (
    <div className={`h-full w-full ${className}`}>
      <Graph3DCanvas />
    </div>
  );
}
