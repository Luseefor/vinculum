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

interface PopoverContentProps {
  children: ReactNode;
  className?: string;
  sideOffset?: number;
  align?: "start" | "end";
  ariaLabel?: string;
}

export function PopoverContent(props: PopoverContentProps) {
  const { open } = usePopoverContext();
  return open ? <Portal><PopoverSurface {...props} /></Portal> : null;
}

function PopoverSurface({ children, className, sideOffset = 8, align = "end", ariaLabel = "Options" }: PopoverContentProps) {
  const { setOpen, triggerRef, popoverId } = usePopoverContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useEffect(() => {
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content) return;
      const bounds = trigger.getBoundingClientRect();
      const width = Math.min(content.offsetWidth, window.innerWidth - 16);
      const height = Math.min(content.offsetHeight, window.innerHeight - 16);
      const below = bounds.bottom + sideOffset;
      const above = bounds.top - sideOffset - height;
      const top = below + height > window.innerHeight - 8 && above >= 8 ? above : below;
      setStyle({
        visibility: "visible", top: Math.max(8, Math.min(top, window.innerHeight - height - 8)),
        left: Math.max(8, Math.min(align === "start" ? bounds.left : bounds.right - width, window.innerWidth - width - 8)),
        minWidth: Math.min(256, window.innerWidth - 16), maxWidth: window.innerWidth - 16,
        maxHeight: window.innerHeight - 16, overflowY: "auto"
      });
    };
    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, sideOffset, triggerRef]);

  useEffect(() => {
    if (style.visibility !== "visible") return;
    const content = contentRef.current;
    const first = content?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex="0"]');
    (first ?? content)?.focus({ preventScroll: true });
  }, [style.visibility]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!contentRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [setOpen, triggerRef]);

  return <div id={popoverId} ref={contentRef} role="dialog" aria-label={ariaLabel} tabIndex={-1}
    className={cn("ui-popover fixed z-[100] min-w-[16rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-xl", className)}
    style={style} onBlur={(event) => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget) && !triggerRef.current?.contains(event.relatedTarget)) setOpen(false);
    }}>{children}</div>;
}
