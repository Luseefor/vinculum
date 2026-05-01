"use client";

import BottomPanel from "@/components/editor/BottomPanel";

interface BottomDockProps {
  height: number;
}

export default function BottomDock({ height }: BottomDockProps) {
  return <BottomPanel height={height} />;
}
