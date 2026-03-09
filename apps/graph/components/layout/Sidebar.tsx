import AddExpressionButton from "@/components/expressions/AddExpressionButton";
import ExpressionList from "@/components/expressions/ExpressionList";
import GraphInspector from "@/components/inspector/GraphInspector";
import { Separator } from "@/components/ui/separator";

export default function Sidebar() {
  return (
    <aside className="flex h-full w-[390px] shrink-0 flex-col border-r bg-card/70">
      <div className="border-b px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Expressions</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Build scenes with surfaces, parametric curves, and planes.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <ExpressionList />
        </div>

        <div className="border-t px-3 py-2.5">
          <AddExpressionButton />
        </div>
      </div>

      <Separator />

      <div className="max-h-[45%] overflow-y-auto px-3 py-3">
        <GraphInspector />
      </div>
    </aside>
  );
}
