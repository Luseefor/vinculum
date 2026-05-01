"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { cn } from "@/components/ui/styles";

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  menuId: string;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenu components must be used within DropdownMenu.");
  }
  return context;
}

export function DropdownMenu({
  open,
  onOpenChange,
  children
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLElement>(null);
  const menuId = useId();
  const wasOpenRef = useRef(open);
  const [restoreFocusOnClose, setRestoreFocusOnClose] = useState(false);
  useEffect(() => {
    if (wasOpenRef.current && !open && restoreFocusOnClose) {
      triggerRef.current?.focus();
      setRestoreFocusOnClose(false);
    }
    wasOpenRef.current = open;
  }, [open, restoreFocusOnClose]);
  const value = useMemo(
    () => ({
      open,
      setOpen: (nextOpen: boolean) => {
        if (!nextOpen && open) {
          setRestoreFocusOnClose(true);
        }
        onOpenChange(nextOpen);
      },
      triggerRef,
      menuId
    }),
    [menuId, onOpenChange, open]
  );
  return (
    <DropdownMenuContext.Provider value={value}>
      <div className="relative">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
  children
}: {
  children: (props: {
    ref: (element: HTMLElement | null) => void;
    "aria-expanded": boolean;
    "aria-controls": string;
    "aria-haspopup": "menu";
    onClick: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  }) => ReactNode;
}) {
  const { open, setOpen, triggerRef, menuId } = useDropdownMenuContext();
  return (
    <>
      {children({
        ref: (element) => {
          triggerRef.current = element;
        },
        "aria-expanded": open,
        "aria-controls": menuId,
        "aria-haspopup": "menu",
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

export function DropdownMenuContent({
  children,
  className,
  align = "start",
  sideOffset = 8
}: {
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
  sideOffset?: number;
}) {
  const { open, setOpen, triggerRef, menuId } = useDropdownMenuContext();
  const contentRef = useRef<HTMLDivElement>(null);

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
    <div
      id={menuId}
      ref={contentRef}
      role="menu"
      aria-orientation="vertical"
      className={cn(
        "absolute z-[100] mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-overlay)] p-1 shadow-2xl backdrop-blur-xl animate-slide-up",
        align === "end" ? "right-0" : "left-0",
        className
      )}
      style={sideOffset ? { marginTop: `${sideOffset}px` } : undefined}
    >
      {children}
    </div>
  );
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-2 py-1 text-[10px] font-medium tracking-wide text-[var(--text-tertiary)]">{children}</p>;
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-[var(--border-subtle)]" />;
}

export function DropdownMenuGroup({ children }: { children: ReactNode }) {
  return <div role="group" className="space-y-0.5">{children}</div>;
}

export function DropdownMenuShortcut({ children }: { children: ReactNode }) {
  return <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">{children}</span>;
}

export function DropdownMenuItem({
  children,
  onSelect,
  disabled = false
}: {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  const { setOpen } = useDropdownMenuContext();
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onSelect?.();
        setOpen(false);
      }}
      className={cn(
        "flex h-8 w-full items-center rounded-md px-2.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)] focus-visible:bg-[var(--accent-soft)] focus-visible:text-[var(--text-primary)]"
      )}
    >
      {children}
    </button>
  );
}
