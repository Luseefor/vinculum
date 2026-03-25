import AddExpressionButton from "@/components/expressions/AddExpressionButton";
import ExpressionList from "@/components/expressions/ExpressionList";
import GraphInspector from "@/components/inspector/GraphInspector";
import { Separator } from "@/components/ui/separator";

export default function Sidebar() {
  return (
    <aside className="skeuo-sidebar flex h-full w-[420px] shrink-0 flex-col border-r border-border">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Expressions</h2>
        <p className="mt-1 text-sm text-muted-foreground">Enter equations to plot surfaces, curves, and planes.</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <ExpressionList />
        </div>

        <div className="border-t border-border px-3 py-2.5">
          <AddExpressionButton />
        </div>
      </div>

      <Separator />

      <div className="max-h-[42%] overflow-y-auto bg-secondary/25 px-3 py-2.5">
        <GraphInspector />
      </div>
    </aside>
  );
}
