"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";

export default function AddObjectMenu() {
  const [open, setOpen] = useState(false);
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const addSurfaceObject = useGraphStore((state) => state.addSurfaceObject);
  const addEmptyObject = useGraphStore((state) => state.addEmptyObject);
  const addParametricCurve = useGraphStore((state) => state.addParametricCurve);
  const addPlaneObject = useGraphStore((state) => state.addPlaneObject);
  const updateSurfaceEquation = useGraphStore((state) => state.updateSurfaceEquation);
  const updateSurfaceDomain = useGraphStore((state) => state.updateSurfaceDomain);
  const updatePlaneEquation = useGraphStore((state) => state.updatePlaneEquation);
  const updateParametricExpression = useGraphStore((state) => state.updateParametricExpression);
  const addConsoleEvent = useEditorStore((state) => state.addConsoleEvent);

  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedObjectId) ?? null,
    [objects, selectedObjectId]
  );

  const createSurfaceTemplate = useCallback(
    (equation: string, message: string, domain?: { xMin: number; xMax: number; yMin: number; yMax: number }) => {
      const id = addSurfaceObject();
      updateSurfaceEquation(id, equation);
      if (domain) {
        updateSurfaceDomain(id, domain);
      }
      addConsoleEvent(message);
    },
    [addConsoleEvent, addSurfaceObject, updateSurfaceDomain, updateSurfaceEquation]
  );

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
          {
            label: "Sphere Cap",
            onClick: () => {
              createSurfaceTemplate(
                "sqrt(max(0, 9 - x^2 - y^2))",
                "Created sphere cap surface template",
                { xMin: -3, xMax: 3, yMin: -3, yMax: 3 }
              );
            }
          },
          {
            label: "Cylinder Shell",
            onClick: () => {
              createSurfaceTemplate(
                "sqrt(max(0, 4 - x^2))",
                "Created cylinder shell surface template",
                { xMin: -2, xMax: 2, yMin: -6, yMax: 6 }
              );
            }
          },
          {
            label: "Box Plateau",
            onClick: () => {
              createSurfaceTemplate(
                "1",
                "Created box plateau surface template",
                { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }
              );
            }
          }
        ]
      },
      {
        title: "Analysis",
        items: [
          {
            label: "Slice Plane",
            onClick: () => {
              const id = addPlaneObject();
              updatePlaneEquation(id, "z = 0");
              addConsoleEvent("Created slice plane at z=0");
            }
          },
          {
            label: "Projection",
            onClick: () => {
              if (!selectedObject || selectedObject.kind !== "parametricCurve") {
                addConsoleEvent("Projection requires a selected parametric curve");
                return;
              }
              const id = addParametricCurve();
              updateParametricExpression(id, "xExpr", selectedObject.xExpr);
              updateParametricExpression(id, "yExpr", selectedObject.yExpr);
              updateParametricExpression(id, "zExpr", "0");
              updateParametricExpression(id, "tMin", selectedObject.tMin);
              updateParametricExpression(id, "tMax", selectedObject.tMax);
              updateParametricExpression(id, "samples", selectedObject.samples);
              addConsoleEvent("Projected selected parametric curve onto z=0");
            }
          }
        ]
      }
    ],
    [
      addConsoleEvent,
      addParametricCurve,
      addPlaneObject,
      addSurfaceObject,
      createSurfaceTemplate,
      selectedObject,
      updateParametricExpression,
      updatePlaneEquation
    ]
  );

  return (
    <div className="relative">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button
          type="button"
          variant="secondary"
          className="justify-center"
          onClick={() => {
            addEmptyObject();
            addConsoleEvent("Added empty expression");
          }}
        >
          + Add Object
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
                    onClick={() => {
                      if (!item.onClick) {
                        return;
                      }
                      item.onClick();
                      setOpen(false);
                    }}
                    className={[
                      "w-full rounded-md px-2 py-1.5 text-left text-[11px]",
                      "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
                    ].join(" ")}
                  >
                    {item.label}
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
