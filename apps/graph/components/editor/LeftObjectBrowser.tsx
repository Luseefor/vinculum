"use client";

import ObjectBrowserPanel from "@/components/layout/ObjectBrowserPanel";

interface LeftObjectBrowserProps {
  width: number;
}

export default function LeftObjectBrowser({ width }: LeftObjectBrowserProps) {
  return <ObjectBrowserPanel width={width} />;
}
