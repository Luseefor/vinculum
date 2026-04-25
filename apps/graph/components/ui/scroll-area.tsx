"use client";

import * as React from "react";
import { cn } from "@/components/ui/styles";

export function ScrollArea({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-auto", className)} {...props} />;
}
