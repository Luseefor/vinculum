"use client";

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { GraphObject, GraphObjectKind, LinearTransformDimension, VectorFieldDimension } from "@vinculum/scene/types";
import { OBJECT_DESCRIPTORS } from "@/lib/objects/objectDescriptors";


// Keep the conversion taxonomy tied to canonical object descriptors.
// The actions menu exposes only the data-preserving dimension switch.
export const CONVERT_OPTIONS: Array<{
  kind: GraphObjectKind;
  dimension?: VectorFieldDimension | LinearTransformDimension;
  label: string;
  value: string;
}> = OBJECT_DESCRIPTORS.map((entry) => ({
  kind: entry.kind,
  dimension: entry.dimension,
  label: entry.label,
  value: entry.dimension ? `${entry.kind}:${entry.dimension}` : entry.kind
}));

type ObjectRowContextMenuProps = {
  object: GraphObject;
  menuOpen: boolean;
  menuPos: { top: number; left: number } | null;
  menuRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onConvertKind: (kind: GraphObjectKind, dimension?: VectorFieldDimension | LinearTransformDimension) => void;
  onRemove: () => void;
  onToggleCurveExtension?: () => void;
};

export function ObjectRowContextMenu({
  object,
  menuOpen,
  menuPos,
  menuRef,
  onConvertKind,
  onToggleCurveExtension,
  onRemove,
  onClose
}: ObjectRowContextMenuProps) {
  const [placement, setPlacement] = useState({ top: 12, left: 12, width: 240, maxHeight: 480 });
  useEffect(() => {
    if (!menuOpen || !menuPos) return;
    const position = () => {
      const width = Math.min(240, window.innerWidth - 24);
      const maxHeight = Math.min(480, window.innerHeight - 24);
      const height = Math.min(menuRef.current?.scrollHeight ?? 480, maxHeight);
      setPlacement({ width, maxHeight, left: Math.max(12, Math.min(menuPos.left, window.innerWidth - width - 12)), top: Math.max(12, Math.min(menuPos.top, window.innerHeight - height - 12)) });
    };
    position();
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [menuOpen, menuPos, menuRef]);
  if (!menuOpen || !menuPos) return null;
  const current = CONVERT_OPTIONS.find(({ kind, dimension }) => object.kind === kind &&
    ((object.kind !== "vectorField" && object.kind !== "linearTransform") || object.dimension === dimension));
  // Generic kind switches rebuild the object with defaults rather than converting
  // its definition. Only transformation dimension changes preserve actual data.
  const options = object.kind === "linearTransform"
    ? CONVERT_OPTIONS.filter(({ kind, dimension }) => kind === "linearTransform" && dimension !== object.dimension)
    : [];

  return createPortal(
    <div ref={menuRef} role="menu" aria-label="Object actions" className="object-convert-menu" style={placement}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); return; }
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
        if (direction || event.key === "Home" || event.key === "End") {
          event.preventDefault();
          buttons[event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + direction + buttons.length) % buttons.length]?.focus();
        }
      }}>
      {object.kind === "implicitCurve" && onToggleCurveExtension && (
        <button type="button" role="menuitemcheckbox" aria-checked={object.extendTo3D === true}
          onClick={onToggleCurveExtension} className="object-convert-dimension">
          {object.extendTo3D ? "Remove 3D extension" : "Extend to 3D"}
        </button>
      )}
      {options.length > 0 && <>
        <div className="object-convert-heading"><strong>Change dimension</strong><span>Current: {current?.label}</span></div>
        {options.map(({ kind, dimension, label, value }) => (
          <button key={value} type="button" role="menuitem" onClick={() => onConvertKind(kind, dimension)} className="object-convert-dimension">{label}</button>
        ))}
      </>}
      <button type="button" role="menuitem" onClick={onRemove} className="object-convert-remove">Remove</button>
    </div>,
    document.activeElement?.closest('[role="dialog"]') ?? document.body
  );
}
