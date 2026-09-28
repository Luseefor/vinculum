"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/lib/store/editorStore";
import {
  createAndFocus,
  createBoxPlateauPreset,
  createCylinderPreset,
  createCylinderShellPreset,
  createImplicitSpherePreset,
  createImplicitTorusPreset,
  createObjectByKey,
  createParametricSpherePreset,
  createParametricTorusPreset,
  createProjectionPreset,
  createSlicePlanePreset,
  createSphereCapPreset,
  createSpherePreset
} from "@/lib/objects/objectCreation";
import { descriptorByKey } from "@/lib/objects/objectDescriptors";
import { useGraphStore } from "@/store/graphStore";

// S30: kind entries render from the central descriptors (labels cannot drift
// from Quick Add / palette / context menu). Only presentation ORDER lives
// here; templates and Analysis helpers stay bespoke menu items.
const GRAPH_KIND_KEYS = [
  "parametricCurve",
  "surface",
  "parametricSurface",
  "implicitSurface",
  "vectorField-2d",
  "vectorField-3d",
  "linearTransform-2d",
  "linearTransform-3d"
];

const PRIMITIVE_KIND_KEYS = ["point", "vector", "line", "segment", "ray", "plane"];

export default function AddObjectMenu() {
  const [open, setOpen] = useState(false);
  const addEmptyObject = useGraphStore((state) => state.addEmptyObject);
  const addConsoleEvent = useEditorStore((state) => state.addConsoleEvent);

  const createMenuKind = useCallback(
    (key: string, message: string) => {
      createObjectByKey(key);
      addConsoleEvent(message);
    },
    [addConsoleEvent]
  );

  const sections = useMemo(
    () => {
      const label = (key: string): string => descriptorByKey(key)?.label ?? key;
      const kindItem = (key: string) => {
        const entryLabel = label(key);
        return {
          label: entryLabel,
          onClick: () => {
            createMenuKind(key, `Created ${entryLabel} from Add menu`);
          }
        };
      };
      return [
        {
          title: "Graphs",
          items: GRAPH_KIND_KEYS.map(kindItem)
        },
        {
          title: "Primitives",
          items: [
            ...PRIMITIVE_KIND_KEYS.map(kindItem),
            {
              label: "Sphere",
              onClick: () => {
                createSpherePreset();
              }
            },
            {
              label: "Cylinder",
              onClick: () => {
                createCylinderPreset();
              }
            },
            {
              label: "Implicit Sphere",
              onClick: () => {
                createImplicitSpherePreset("Created implicit sphere template");
              }
            },
            {
              label: "Implicit Torus",
              onClick: () => {
                createImplicitTorusPreset();
              }
            },
            {
              label: "Parametric Sphere",
              onClick: () => {
                createParametricSpherePreset("Created parametric sphere template");
              }
            },
            {
              label: "Parametric Torus",
              onClick: () => {
                createParametricTorusPreset("Created parametric torus template");
              }
            },
            {
              label: "Sphere Cap",
              onClick: () => {
                createSphereCapPreset();
              }
            },
            {
              label: "Cylinder Shell",
              onClick: () => {
                createCylinderShellPreset();
              }
            },
            {
              label: "Box Plateau",
              onClick: () => {
                createBoxPlateauPreset();
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
                createSlicePlanePreset();
              }
            },
            {
              label: "Projection",
              onClick: () => {
                createProjectionPreset();
              }
            }
          ]
        }
      ];
    },
    [createMenuKind]
  );

  return (
    <div className="relative">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button
          type="button"
          variant="secondary"
          className="justify-center"
          onClick={() => {
            // S30: empty-object creation focuses its definition like every
            // other creation path (was a focus regression vs Quick Add).
            createAndFocus(() => addEmptyObject());
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
        <div className="overflow-menu-scroll absolute left-0 top-full z-30 mt-2 w-full min-w-[14rem] overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-2 shadow-[var(--shadow-floating)]">
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
