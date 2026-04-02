import AddExpressionButton from "@/components/expressions/AddExpressionButton";
import ExpressionList from "@/components/expressions/ExpressionList";
import GraphInspector from "@/components/inspector/GraphInspector";

export default function Sidebar() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-hidden p-2 pr-0 bg-[var(--surface-bg)]">
      <div className="panel px-3 py-2.5">
        <h2 className="text-[11px] font-semibold text-[var(--text-primary)]">Expressions</h2>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto pr-2">
          <ExpressionList />
        </div>

        <div className="mt-2 pr-2">
          <AddExpressionButton />
        </div>
      </div>

      <div className="mt-2 max-h-[42%] shrink-0 overflow-y-auto pr-2">
        <GraphInspector />
      </div>
    </aside>
  );
}
