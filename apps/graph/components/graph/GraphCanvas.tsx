"use client";

import { useEffect, useRef } from "react";
import { createGraphThreeEngine } from "@/lib/graph3d/GraphThreeEngine";

export default function GraphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const engine = createGraphThreeEngine(element);
    return () => {
      engine.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" />
  );
}
