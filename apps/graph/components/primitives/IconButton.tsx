"use client";

import type { ButtonProps } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/styles";

export function IconButton({ className, size = "icon", variant = "ghost", ...props }: ButtonProps) {
  return <Button size={size} variant={variant} className={cn("h-8 w-8 p-0", className)} {...props} />;
}
