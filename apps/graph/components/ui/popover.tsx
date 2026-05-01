"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import { Portal } from "@/components/ui/portal";
import { cn } from "@/components/ui/styles";

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  popoverId: string;
};

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const context = useContext(PopoverContext);
  if (!context) {
    throw new Error("Popover components must be used within Popover.");
  }
  return context;
}

export function Popover({
  open,
  onOpenChange,
  children
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLElement>(null);
  const popoverId = useId();
  const value = useMemo(
    () => ({ open, setOpen: onOpenChange, triggerRef, popoverId }),
    [onOpenChange, open, popoverId]
  );
  return <PopoverContext.Provider value={value}>{children}</PopoverContext.Provider>;
}

export function PopoverTrigger({
  children
}: {
  children: (props: {
    ref: (element: HTMLElement | null) => void;
    "aria-expanded": boolean;
    "aria-controls": string;
    "aria-haspopup": "dialog";
    onClick: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  }) => ReactNode;
}) {
  const { open, setOpen, triggerRef, popoverId } = usePopoverContext();
  return (
    <>
      {children({
        ref: (element) => {
          triggerRef.current = element;
        },
        "aria-expanded": open,
        "aria-controls": popoverId,
        "aria-haspopup": "dialog",
        onClick: () => setOpen(!open),
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(!open);
            return;
          }
          if (event.key === "Escape") {
            setOpen(false);
          }
        }
      })}
    </>
  );
}

export function PopoverContent({
  children,
  className,
  sideOffset = 8,
  align = "end"
}: {
  children: ReactNode;
  className?: string;
  sideOffset?: number;
  align?: "start" | "end";
}) {
  const { open, setOpen, triggerRef, popoverId } = usePopoverContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) {
      return;
    }
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content) {
        return;
      }
      const triggerRect = trigger.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const top = triggerRect.bottom + sideOffset;
      const left =
        align === "start"
          ? Math.max(8, triggerRect.left)
          : Math.max(8, triggerRect.right - contentRect.width);
      setStyle({ top, left });
    };
    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);
    const timer = window.setTimeout(updatePosition, 0);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, open, sideOffset, triggerRef]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (contentRef.current?.contains(target)) {
        return;
      }
      if (triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, setOpen, triggerRef]);

  if (!open) {
    return null;
  }

  return (
    <Portal>
      <div
        id={popoverId}
        ref={contentRef}
        role="dialog"
        className={cn(
          "fixed z-[100] min-w-[16rem] rounded-xl border border-[var(--border-strong)] bg-[var(--surface-overlay)] shadow-2xl backdrop-blur-xl animate-slide-up",
          className
        )}
        style={style}
      >
        {children}
      </div>
    </Portal>
  );
}
