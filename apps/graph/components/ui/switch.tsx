"use client";

import * as React from "react";
import { cn } from "@/components/ui/styles";

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, className, ariaLabel, ...props }, ref
) {
  return <button {...props} ref={ref} type="button" role="switch" aria-checked={checked}
    aria-label={ariaLabel ?? props["aria-label"]} onClick={() => onCheckedChange(!checked)}
    className={cn("ui-switch", className)}>
    <span className="ui-switch-track" aria-hidden="true"><span className="ui-switch-thumb" /></span>
  </button>;
});
