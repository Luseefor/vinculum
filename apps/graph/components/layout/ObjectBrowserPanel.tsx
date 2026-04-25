"use client";

import ObjectTree from "@/components/objects/ObjectTree";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";
import { SearchIcon } from "@/components/layout/icons";

interface ObjectBrowserPanelProps {
  width: number;
}

export default function ObjectBrowserPanel({ width }: ObjectBrowserPanelProps) {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const addSurfaceObject = useGraphStore((state) => state.addSurfaceObject);
  const addParametricCurve = useGraphStore((state) => state.addParametricCurve);
  const addPlaneObject = useGraphStore((state) => state.addPlaneObject);
  const updateSurfaceEquation = useGraphStore((state) => state.updateSurfaceEquation);
  const updateSurfaceDomain = useGraphStore((state) => state.updateSurfaceDomain);
  const updateParametricExpression = useGraphStore((state) => state.updateParametricExpression);
  const addConsoleEvent = useEditorStore((state) => state.addConsoleEvent);

  const createSphere = () => {
    const id = addSurfaceObject();
    updateSurfaceEquation(id, "sqrt(max(0, 9 - x^2 - y^2))");
    updateSurfaceDomain(id, { xMin: -3, xMax: 3, yMin: -3, yMax: 3 });
    addConsoleEvent("Created sphere surface preset");
  };

  const createCylinder = () => {
    const id = addSurfaceObject();
    updateSurfaceEquation(id, "sqrt(max(0, 4 - x^2))");
    updateSurfaceDomain(id, { xMin: -2, xMax: 2, yMin: -6, yMax: 6 });
    addConsoleEvent("Created cylinder surface preset");
  };

  const createPoint = () => {
    const id = addParametricCurve();
    updateParametricExpression(id, "xExpr", "0");
    updateParametricExpression(id, "yExpr", "0");
    updateParametricExpression(id, "zExpr", "0");
    updateParametricExpression(id, "tMin", 0);
    updateParametricExpression(id, "tMax", 1);
    updateParametricExpression(id, "samples", 2);
    addConsoleEvent("Created point marker preset");
  };

  return (
    <aside
      className="flex h-full shrink-0 flex-col border-r border-[var(--panel-border)] bg-[var(--bg-tertiary)]"
      style={{ width }}
    >
      <div className="flex flex-col gap-4 px-4 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Scene</p>
          <div className="mt-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Objects</h2>
            <span className="flex h-5 items-center justify-center rounded bg-[var(--surface-muted)] px-1.5 font-mono text-[10px] font-bold text-[var(--text-muted)]">
              {objectCount}
            </span>
          </div>
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Search objects..."
            className="h-9 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] pl-9 pr-3 text-[11px] font-medium outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
          />
        </div>

        <Button
          variant="secondary"
          className="h-9 w-full rounded-md border-[var(--border-strong)] bg-[var(--bg-tertiary)] text-[11px] font-bold"
          onClick={() => {
            addSurfaceObject();
            addConsoleEvent("Added new object");
          }}
        >
          + Add Object
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3">
        <ObjectTree />
      </ScrollArea>

      <div className="border-t border-[var(--panel-border)] p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Quick Add</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Surface", onClick: () => addSurfaceObject() },
            { label: "Curve", onClick: () => addParametricCurve() },
            { label: "Sphere", onClick: createSphere },
            { label: "Cylinder", onClick: createCylinder },
            { label: "Plane", onClick: () => addPlaneObject() },
            { label: "Point", onClick: createPoint }
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] text-[10px] font-bold text-[var(--text-secondary)] transition-all hover:border-[var(--accent)] hover:text-[var(--text-primary)] active:scale-[0.97]"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
