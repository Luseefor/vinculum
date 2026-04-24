"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";

export default function AddObjectMenu() {
  const [open, setOpen] = useState(false);
  const addSurfaceObject = useGraphStore((state) => state.addSurfaceObject);
  const addParametricCurve = useGraphStore((state) => state.addParametricCurve);
  const addPlaneObject = useGraphStore((state) => state.addPlaneObject);
  const addConsoleEvent = useEditorStore((state) => state.addConsoleEvent);

  const sections = useMemo(
    () => [
      {
        title: "Graphs",
        items: [
          {
            label: "2D / 3D Curve",
            onClick: () => {
              addParametricCurve();
              addConsoleEvent("Created parametric curve from Add menu");
            }
          },
          {
            label: "Surface",
            onClick: () => {
              addSurfaceObject();
              addConsoleEvent("Created surface from Add menu");
            }
          }
        ]
      },
      {
        title: "Primitives",
        items: [
          {
            label: "Plane",
            onClick: () => {
              addPlaneObject();
              addConsoleEvent("Created plane from Add menu");
            }
          },
          { label: "Sphere", disabled: true },
          { label: "Cylinder", disabled: true },
          { label: "Box", disabled: true }
        ]
      },
      {
        title: "Analysis",
        items: [{ label: "Slice Plane", disabled: true }, { label: "Projection", disabled: true }]
      }
    ],
    [addConsoleEvent, addParametricCurve, addPlaneObject, addSurfaceObject]
  );

  return (
    <div className="relative">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button
          type="button"
          variant="secondary"
          className="justify-center"
          onClick={() => {
            addSurfaceObject();
            addConsoleEvent("Created surface from quick add");
          }}
        >
          Add
        </Button>
        <Button type="button" variant="ghost" className="px-2" onClick={() => setOpen((v) => !v)} aria-label="Open object menu">
          ▾
        </Button>
      </div>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-full min-w-[14rem] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-2 shadow-[var(--shadow-floating)]">
          {sections.map((section) => (
            <div key={section.title} className="mb-2 last:mb-0">
              <p className="mb-1 px-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{section.title}</p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                      if (item.disabled || !item.onClick) {
                        return;
                      }
                      item.onClick();
                      setOpen(false);
                    }}
                    className={[
                      "w-full rounded-md px-2 py-1.5 text-left text-[11px]",
                      item.disabled
                        ? "cursor-not-allowed text-[var(--text-muted)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
                    ].join(" ")}
                  >
                    {item.label}
                    {item.disabled ? <span className="ml-2 text-[10px] text-[var(--text-muted)]">Coming soon</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-2 border-t border-[var(--border-subtle)] pt-2">
            <Button type="button" size="sm" variant="ghost" className="w-full" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
