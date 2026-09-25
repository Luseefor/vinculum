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
  const addParametricSurface = useGraphStore((state) => state.addParametricSurface);
  const addImplicitSurface = useGraphStore((state) => state.addImplicitSurface);
  const addVectorFieldObject = useGraphStore((state) => state.addVectorFieldObject);
  const addPlaneObject = useGraphStore((state) => state.addPlaneObject);
  const addPointObject = useGraphStore((state) => state.addPointObject);
  const addVectorObject = useGraphStore((state) => state.addVectorObject);
  const addLineObject = useGraphStore((state) => state.addLineObject);
  const addRayObject = useGraphStore((state) => state.addRayObject);
  const addSegmentObject = useGraphStore((state) => state.addSegmentObject);
  const requestEquationFocus = useGraphStore((state) => state.requestEquationFocus);
  const updateSurfaceEquation = useGraphStore((state) => state.updateSurfaceEquation);
  const updateSurfaceDomain = useGraphStore((state) => state.updateSurfaceDomain);
  const updatePlaneEquation = useGraphStore((state) => state.updatePlaneEquation);
  const updateParametricExpression = useGraphStore((state) => state.updateParametricExpression);
  const updateParametricSurfaceExpression = useGraphStore((state) => state.updateParametricSurfaceExpression);
  const updateImplicitSurfaceExpression = useGraphStore((state) => state.updateImplicitSurfaceExpression);
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
      requestEquationFocus(id);
      addConsoleEvent(message);
    },
    [addConsoleEvent, addSurfaceObject, requestEquationFocus, updateSurfaceDomain, updateSurfaceEquation]
  );

  const createParametricSurfaceTemplate = useCallback(
    (
      expressions: { xExpr: string; yExpr: string; zExpr: string },
      domain: { uMin: number; uMax: number; vMin: number; vMax: number },
      message: string
    ) => {
      const id = addParametricSurface();
      updateParametricSurfaceExpression(id, "xExpr", expressions.xExpr);
      updateParametricSurfaceExpression(id, "yExpr", expressions.yExpr);
      updateParametricSurfaceExpression(id, "zExpr", expressions.zExpr);
      updateParametricSurfaceExpression(id, "uMin", domain.uMin);
      updateParametricSurfaceExpression(id, "uMax", domain.uMax);
      updateParametricSurfaceExpression(id, "vMin", domain.vMin);
      updateParametricSurfaceExpression(id, "vMax", domain.vMax);
      requestEquationFocus(id);
      addConsoleEvent(message);
    },
    [addConsoleEvent, addParametricSurface, requestEquationFocus, updateParametricSurfaceExpression]
  );

  const createImplicitSurfaceTemplate = useCallback(
    (
      equation: string,
      domain: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number },
      message: string
    ) => {
      const id = addImplicitSurface();
      updateImplicitSurfaceExpression(id, "equation", equation);
      updateImplicitSurfaceExpression(id, "xMin", domain.xMin);
      updateImplicitSurfaceExpression(id, "xMax", domain.xMax);
      updateImplicitSurfaceExpression(id, "yMin", domain.yMin);
      updateImplicitSurfaceExpression(id, "yMax", domain.yMax);
      updateImplicitSurfaceExpression(id, "zMin", domain.zMin);
      updateImplicitSurfaceExpression(id, "zMax", domain.zMax);
      requestEquationFocus(id);
      addConsoleEvent(message);
    },
    [addConsoleEvent, addImplicitSurface, requestEquationFocus, updateImplicitSurfaceExpression]
  );

  const createAndFocus = useCallback(
    (create: () => string) => {
      const id = create();
      if (id) {
        requestEquationFocus(id);
      }
    },
    [requestEquationFocus]
  );

  const sections = useMemo(
    () => [
      {
        title: "Graphs",
        items: [
          {
            label: "2D / 3D Curve",
            onClick: () => {
              createAndFocus(() => addParametricCurve());
              addConsoleEvent("Created parametric curve from Add menu");
            }
          },
          {
            label: "Surface",
            onClick: () => {
              createAndFocus(() => addSurfaceObject());
              addConsoleEvent("Created surface from Add menu");
            }
          },
          {
            label: "Parametric Surface",
            onClick: () => {
              createAndFocus(() => addParametricSurface());
              addConsoleEvent("Created parametric surface from Add menu");
            }
          },
          {
            label: "Implicit Surface",
            onClick: () => {
              createAndFocus(() => addImplicitSurface());
              addConsoleEvent("Created implicit surface from Add menu");
            }
          },
          {
            label: "2D Vector Field",
            onClick: () => {
              createAndFocus(() => addVectorFieldObject("2d"));
              addConsoleEvent("Created 2D vector field from Add menu");
            }
          },
          {
            label: "3D Vector Field",
            onClick: () => {
              createAndFocus(() => addVectorFieldObject("3d"));
              addConsoleEvent("Created 3D vector field from Add menu");
            }
          }
        ]
      },
      {
        title: "Primitives",
        items: [
          {
            label: "Point",
            onClick: () => {
              createAndFocus(() => addPointObject());
              addConsoleEvent("Created point from Add menu");
            }
          },
          {
            label: "Vector",
            onClick: () => {
              createAndFocus(() => addVectorObject());
              addConsoleEvent("Created vector from Add menu");
            }
          },
          {
            label: "Infinite Line",
            onClick: () => {
              createAndFocus(() => addLineObject());
              addConsoleEvent("Created infinite line from Add menu");
            }
          },
          {
            label: "Segment",
            onClick: () => {
              createAndFocus(() => addSegmentObject());
              addConsoleEvent("Created segment from Add menu");
            }
          },
          {
            label: "Ray",
            onClick: () => {
              createAndFocus(() => addRayObject());
              addConsoleEvent("Created ray from Add menu");
            }
          },
          {
            label: "Plane",
            onClick: () => {
              createAndFocus(() => addPlaneObject());
              addConsoleEvent("Created plane from Add menu");
            }
          },
          {
            label: "Implicit Sphere",
            onClick: () => {
              createImplicitSurfaceTemplate(
                "x^2 + y^2 + z^2 = 1",
                { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 },
                "Created implicit sphere template"
              );
            }
          },
          {
            label: "Implicit Torus",
            onClick: () => {
              createImplicitSurfaceTemplate(
                "(x^2 + y^2 + z^2 + 3.75)^2 - 16 * (x^2 + y^2) = 0",
                { xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -1, zMax: 1 },
                "Created implicit torus template"
              );
            }
          },
          {
            label: "Parametric Sphere",
            onClick: () => {
              createParametricSurfaceTemplate(
                { xExpr: "sin(u) * cos(v)", yExpr: "sin(u) * sin(v)", zExpr: "cos(u)" },
                { uMin: 0, uMax: 3.1415926536, vMin: 0, vMax: 6.2831853072 },
                "Created parametric sphere template"
              );
            }
          },
          {
            label: "Parametric Torus",
            onClick: () => {
              createParametricSurfaceTemplate(
                {
                  xExpr: "(2 + 0.5 * cos(v)) * cos(u)",
                  yExpr: "(2 + 0.5 * cos(v)) * sin(u)",
                  zExpr: "0.5 * sin(v)"
                },
                { uMin: 0, uMax: 6.2831853072, vMin: 0, vMax: 6.2831853072 },
                "Created parametric torus template"
              );
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
              requestEquationFocus(id);
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
              requestEquationFocus(id);
              addConsoleEvent("Projected selected parametric curve onto z=0");
            }
          }
        ]
      }
    ],
    [
      addConsoleEvent,
      addParametricCurve,
      addParametricSurface,
      addImplicitSurface,
      addLineObject,
      addRayObject,
      addSegmentObject,
      addVectorFieldObject,
      addVectorObject,
      addPlaneObject,
      addSurfaceObject,
      createAndFocus,
      createImplicitSurfaceTemplate,
      createParametricSurfaceTemplate,
      createSurfaceTemplate,
      requestEquationFocus,
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
