"use client";

import SceneNavigator from "@/components/editor/SceneNavigator";

interface SceneNavigatorPremiumProps {
  width: number;
}

export default function SceneNavigatorPremium({ width }: SceneNavigatorPremiumProps) {
  return <SceneNavigator width={width} />;
}
