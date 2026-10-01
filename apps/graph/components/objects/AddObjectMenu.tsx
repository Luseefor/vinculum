"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/layout/icons";
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

  const iconButton =
    "flex h-7 items-center justify-center text-[var(--text-secondary)] outline-none transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]";

  return (
    <div className="relative">
      <button
        type="button"
        className={`${iconButton} w-7 rounded-[var(--radius-sm)] ${open ? "bg-[var(--surface-muted)] text-[var(--text-primary)]" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open object menu"
        title="Add object"
        aria-expanded={open}
      >
        <PlusIcon className="h-4 w-4" />
      </button>
      {open ? (
        <div className="overflow-menu-scroll animate-fade-in absolute right-0 top-full z-30 mt-2 w-60 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-floating)]">
          <button
            type="button"
            onClick={() => {
              // S30: empty-object creation focuses its definition like every
              // other creation path.
              createAndFocus(() => addEmptyObject());
              addConsoleEvent("Added empty expression");
              setOpen(false);
            }}
            className="mb-1 w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[13px] font-medium text-[var(--text-primary)] outline-none hover:bg-[var(--surface-muted)] focus-visible:bg-[var(--surface-muted)]"
          >
            Empty expression
          </button>
          {sections.map((section) => (
            <div key={section.title} className="mb-1.5 last:mb-0">
              <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-[var(--text-tertiary)]">{section.title}</p>
              <div>
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
                    className="w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[13px] text-[var(--text-primary)] outline-none hover:bg-[var(--surface-muted)] focus-visible:bg-[var(--surface-muted)]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-1 border-t border-[var(--border-subtle)] pt-1">
            <Button type="button" size="sm" variant="ghost" className="w-full" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
