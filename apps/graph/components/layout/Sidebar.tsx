import AddExpressionButton from "@/components/expressions/AddExpressionButton";
import ExpressionList from "@/components/expressions/ExpressionList";
import GraphInspector from "@/components/inspector/GraphInspector";
import { useGraphStore } from "@/store/graphStore";

export default function Sidebar() {
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);

  return (
    <aside className="flex h-full w-[22rem] shrink-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface-bg)]">
      <div className="border-b border-[var(--border-subtle)] px-4 pb-3 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
          Workspace
        </p>
        <div className="mt-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Objects</h2>
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
            {objectCount}
          </span>
        </div>
        <div className="mt-3">
          <AddExpressionButton />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <ExpressionList />
      </div>

      <div className="shrink-0 border-t border-[var(--border-subtle)] px-3 py-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            Inspector
          </h3>
          {selectedObjectId && (
            <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
              {selectedObjectId.slice(0, 8)}
            </span>
          )}
        </div>
        <div className="max-h-[42vh] overflow-y-auto pr-1">
          <GraphInspector />
        </div>
      </div>
    </aside>
  );
}
