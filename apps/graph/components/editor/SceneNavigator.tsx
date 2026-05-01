"use client";

import LeftObjectBrowser from "@/components/editor/LeftObjectBrowser";

interface SceneNavigatorProps {
  width: number;
}

export default function SceneNavigator({ width }: SceneNavigatorProps) {
  return <LeftObjectBrowser width={width} />;
}
