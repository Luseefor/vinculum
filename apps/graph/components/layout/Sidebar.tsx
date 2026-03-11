import AddExpressionButton from "@/components/expressions/AddExpressionButton";
import ExpressionList from "@/components/expressions/ExpressionList";
import GraphInspector from "@/components/inspector/GraphInspector";
import { Separator } from "@/components/ui/separator";

export default function Sidebar() {
  return (
    <aside className="skeuo-sidebar flex h-full w-[430px] shrink-0 flex-col border-r border-border/80">
      <div className="border-b border-border/70 px-4 py-3">
        <div className="skeuo-panel px-4 py-3">
          <p className="text-[0.74rem] font-semibold uppercase tracking-[0.32em] text-muted-foreground">Expressions</p>
          <p className="mt-1.5 text-[1.02rem] leading-relaxed text-muted-foreground">
            Build mixed scenes with surfaces, parametric curves, and planes.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <ExpressionList />
        </div>

        <div className="border-t border-border/70 px-3 py-2.5">
          <AddExpressionButton />
        </div>
      </div>

      <Separator className="bg-border/70" />

      <div className="max-h-[45%] overflow-y-auto px-3 py-3">
        <GraphInspector />
      </div>
    </aside>
  );
}
