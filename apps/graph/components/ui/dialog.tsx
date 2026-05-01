"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode
} from "react";
import { useDialogFocusTrap } from "@/lib/a11y/useDialogFocusTrap";
import { cn } from "@/components/ui/styles";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within Dialog.");
  }
  return context;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const id = useId();
  const contextValue = useMemo(
    () => ({
      open,
      onOpenChange,
      titleId: `${id}-title`,
      descriptionId: `${id}-description`
    }),
    [id, onOpenChange, open]
  );
  return <DialogContext.Provider value={contextValue}>{children}</DialogContext.Provider>;
}

export function DialogContent({
  children,
  className,
  contentProps,
  backdropProps,
  contentTestId,
  backdropTestId
}: {
  children: ReactNode;
  className?: string;
  contentProps?: ComponentPropsWithoutRef<"div">;
  backdropProps?: ComponentPropsWithoutRef<"div">;
  contentTestId?: string;
  backdropTestId?: string;
}) {
  const { open, onOpenChange, titleId, descriptionId } = useDialogContext();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap({ open, containerRef: dialogRef });

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--surface-backdrop)] p-6 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
      data-testid={backdropTestId}
      {...backdropProps}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          "w-full overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-overlay)] shadow-2xl",
          className
        )}
        onClick={(event) => event.stopPropagation()}
        data-testid={contentTestId}
        {...contentProps}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border-b border-[var(--border-subtle)] px-5 py-4", className)}>{children}</div>;
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  const { titleId } = useDialogContext();
  return (
    <h2 id={titleId} className={cn("text-sm font-semibold text-[var(--text-primary)]", className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({ children, className }: { children: ReactNode; className?: string }) {
  const { descriptionId } = useDialogContext();
  return (
    <p id={descriptionId} className={cn("mt-1 text-[11px] text-[var(--text-tertiary)]", className)}>
      {children}
    </p>
  );
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4", className)}>{children}</div>;
}
