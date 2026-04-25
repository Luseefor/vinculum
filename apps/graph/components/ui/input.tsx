"use client";

import * as React from "react";
import { cn } from "@/components/ui/styles";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={cn("input", className)} {...props} />;
});
