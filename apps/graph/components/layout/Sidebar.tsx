import AddExpressionButton from "@/components/expressions/AddExpressionButton";
import ExpressionList from "@/components/expressions/ExpressionList";
import GraphInspector from "@/components/inspector/GraphInspector";

export default function Sidebar() {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-hidden p-3 pr-0">
      <div className="panel px-4 py-3">
        <h2 className="text-xs font-semibold text-[var(--text-primary)]">Expressions</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
          Surfaces, curves, and planes
        </p>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto pr-3">
          <ExpressionList />
        </div>

        <div className="mt-3 pr-3">
          <AddExpressionButton />
        </div>
      </div>

      <div className="mt-3 max-h-[45%] shrink-0 overflow-y-auto pr-3">
        <GraphInspector />
      </div>
    </aside>
  );
}
