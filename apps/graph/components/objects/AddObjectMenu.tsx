"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, PlusIcon } from "@/components/layout/icons";
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
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const catalogId = useId();
  const catalogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [placement, setPlacement] = useState({ left: 12, top: 48, width: 360, maxHeight: 480 });
  const positionCatalog = useCallback(() => {
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const width = Math.min(360, window.innerWidth - 24);
    const below = window.innerHeight - bounds.bottom - 20;
    const above = bounds.top - 20;
    const flip = below < 240 && above > below;
    const maxHeight = Math.min(480, Math.max(120, flip ? above : below));
    setPlacement({ width, maxHeight, left: Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)), top: flip ? Math.max(12, bounds.top - maxHeight - 8) : bounds.bottom + 8 });
  }, []);
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target) && !catalogRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", positionCatalog);
    window.addEventListener("scroll", positionCatalog, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", positionCatalog);
      window.removeEventListener("scroll", positionCatalog, true);
    };
  }, [open, positionCatalog]);
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
          title: "Geometry", items: PRIMITIVE_KIND_KEYS.map(kindItem)
        },
        {
          title: "Examples",
          items: [
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

  const filteredSections = sections
    .filter(section => category === "All" || category === section.title)
    .map(section => ({ ...section, items: section.items.filter(item => item.label.toLowerCase().includes(query.trim().toLowerCase())) }))
    .filter(section => section.items.length > 0);

  const closeCatalog = () => { setOpen(false); triggerRef.current?.focus(); };
  const iconButton =
    "flex h-7 items-center justify-center text-[var(--text-secondary)] outline-none transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]";

  return (
    <div ref={rootRef} className="relative" onKeyDown={event => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopPropagation();
        closeCatalog();
      }
    }}>
      <button
        ref={triggerRef}
        type="button"
        className={`${iconButton} gap-1 px-2 rounded-[var(--radius-sm)] ${open ? "bg-[var(--surface-muted)] text-[var(--text-primary)]" : ""}`}
        onClick={() => {
          if (!open) { positionCatalog(); setQuery(""); setCategory("All"); }
          setOpen(value => !value);
        }}
        aria-haspopup="dialog"
        aria-label="Open object menu"
        aria-expanded={open}
        aria-controls={open ? catalogId : undefined}
        title="Add object"
      >
        <PlusIcon className="h-4 w-4" />
        <span className="text-[12px] font-medium">Add</span>
      </button>
      {open ? createPortal(
        <div ref={catalogRef} id={catalogId} data-object-catalog role="dialog" aria-labelledby={`${catalogId}-title`} className="object-catalog animate-fade-in" style={placement}>
          <div className="object-catalog-header">
            <h2 id={`${catalogId}-title`} className="text-[14px] font-semibold text-[var(--text-primary)]">Add to graph</h2>
            <button type="button" aria-label="Close object picker" onClick={closeCatalog} className="object-catalog-close"><CloseIcon className="h-4 w-4" /></button>
          </div>
          <input ref={searchRef} type="search" aria-label="Search objects" placeholder="Search objects and examples…" value={query} onChange={event => setQuery(event.target.value)} className="object-catalog-search" />
          <div className="object-catalog-filters" aria-label="Object categories">
            {["All", ...sections.map(section => section.title)].map(label => <button key={label} type="button" aria-pressed={category === label} onClick={() => setCategory(label)}>{label}</button>)}
          </div>
          <div className="object-catalog-results">
            {!query && category === "All" && <button type="button" className="object-catalog-empty" onClick={() => {
              createAndFocus(() => addEmptyObject());
              addConsoleEvent("Added empty expression");
              setOpen(false);
            }}><PlusIcon className="h-4 w-4" />Empty expression</button>}
            {filteredSections.map(section => <section key={section.title} aria-label={`${section.title} objects`}>
              <h3 className="mb-2 text-[11px] font-medium text-[var(--text-tertiary)]">{section.title}</h3>
              <div className="object-catalog-grid">
                {section.items.map(item => <button key={item.label} type="button" onClick={() => { item.onClick(); setOpen(false); }}>{item.label}</button>)}
              </div>
            </section>)}
            {filteredSections.length === 0 && <div className="py-5 text-[12px] text-[var(--text-secondary)]">
              <p>No objects match “{query}”.</p>
              <button type="button" onClick={() => { setQuery(""); setCategory("All"); searchRef.current?.focus(); }} className="mt-2 rounded-lg px-2 py-1 text-[var(--accent-ink)] hover:bg-[var(--accent-soft)]">Clear filters</button>
            </div>}
          </div>
        </div>, rootRef.current?.closest('[role="dialog"]') ?? document.body
      ) : null}
    </div>
  );
}
