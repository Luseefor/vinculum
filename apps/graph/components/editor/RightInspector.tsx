"use client";

import InspectorPanel from "@/components/layout/InspectorPanel";

interface RightInspectorProps {
  width: number;
}

export default function RightInspector({ width }: RightInspectorProps) {
  return <InspectorPanel width={width} />;
}
