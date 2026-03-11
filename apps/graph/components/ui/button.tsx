import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "border-border/80 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--background)/0.9))] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.18),0_2px_8px_hsl(var(--background)/0.32)] hover:text-primary",
        secondary:
          "border-border/80 bg-[linear-gradient(180deg,hsl(var(--secondary)/0.96),hsl(var(--muted)/0.9))] text-secondary-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16)] hover:text-foreground",
        outline:
          "border-border/80 bg-[linear-gradient(180deg,hsl(var(--card)/0.95),hsl(var(--background)/0.88))] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.16)] hover:text-primary",
        ghost: "border-transparent bg-transparent text-foreground/90 hover:bg-accent/40 hover:text-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      },
      size: {
        default: "h-9 px-3 py-2",
        sm: "h-8 rounded-md px-2.5 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
