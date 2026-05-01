"use client";

import BottomDock from "@/components/editor/BottomDock";

interface BottomDockPremiumProps {
  height: number;
}

export default function BottomDockPremium({ height }: BottomDockPremiumProps) {
  return <BottomDock height={height} />;
}
