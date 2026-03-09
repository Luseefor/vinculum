import AddExpressionButton from "@/components/expressions/AddExpressionButton";
import ExpressionList from "@/components/expressions/ExpressionList";
import GraphInspector from "@/components/inspector/GraphInspector";
import { ui } from "@/components/ui/styles";

export default function Sidebar() {
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-hidden border-r border-slate-800/90 bg-slate-950/90 px-3 py-3">
      <div className={ui.panelMuted + " px-3 py-2.5"}>
        <h2 className={ui.sectionTitle}>Expressions</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          Build mixed scenes with surfaces, parametric curves, and planes.
        </p>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <ExpressionList />
        </div>

        <div className="mt-2 border-t border-slate-800/80 pt-2">
          <AddExpressionButton />
        </div>
      </div>

      <div className="mt-3 max-h-[47%] shrink-0 overflow-y-auto border-t border-slate-800/80 pt-3 pr-1">
        <GraphInspector />
      </div>
    </aside>
  );
}
