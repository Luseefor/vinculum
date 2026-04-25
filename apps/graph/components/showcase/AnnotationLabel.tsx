"use client";

import { cn } from "@/components/ui/styles";

interface AnnotationLabelProps {
  title: string;
  description: string;
  side: "left" | "right";
  top: string;
}

export default function AnnotationLabel({ title, description, side, top }: AnnotationLabelProps) {
  return (
    <div className={cn("annotation-label", side === "left" ? "annotation-left" : "annotation-right")} style={{ top }}>
      <h4>{title}</h4>
      <p>{description}</p>
      <div className="annotation-arrow" aria-hidden="true">
        {side === "left" ? "────▶" : "◀────"}
      </div>
    </div>
  );
}
