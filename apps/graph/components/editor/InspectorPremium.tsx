"use client";

import InspectorShell from "@/components/editor/InspectorShell";

interface InspectorPremiumProps {
  width: number;
  onOpenExamples?: () => void;
}

export default function InspectorPremium({ width, onOpenExamples }: InspectorPremiumProps) {
  return <InspectorShell width={width} onOpenExamples={onOpenExamples} />;
}
