"use client";

import ExpressionList from "@/components/expressions/ExpressionList";
import AddObjectMenu from "@/components/objects/AddObjectMenu";
import ObjectTree from "@/components/objects/ObjectTree";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGraphStore } from "@/store/graphStore";

interface ObjectBrowserPanelProps {
  width: number;
}

export default function ObjectBrowserPanel({ width }: ObjectBrowserPanelProps) {
  const objectCount = useGraphStore((state) => state.scene.objects.length);

  return (
    <aside
      className="flex h-full shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-bg)]"
      style={{ width }}
    >
      <div className="border-b border-[var(--border-subtle)] px-3 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Object Browser</p>
        <div className="mt-1 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[var(--text-primary)]">Scene Objects</h2>
          <span className="rounded bg-[var(--surface-overlay)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
            {objectCount}
          </span>
        </div>
        <div className="mt-3">
          <AddObjectMenu />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2 py-2">
        <ObjectTree />
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-2">
          <p className="mb-1 px-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Legacy List</p>
          <ExpressionList />
        </div>
      </ScrollArea>
    </aside>
  );
}
