"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useEditorStore, type EditorConstraintType } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";

export default function ConstraintsTab() {
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const constraints = useEditorStore((state) => state.constraints);
  const addConstraint = useEditorStore((state) => state.addConstraint);
  const toggleConstraint = useEditorStore((state) => state.toggleConstraint);
  const removeConstraint = useEditorStore((state) => state.removeConstraint);

  const selectedConstraints = constraints.filter((constraint) =>
    selectedObjectId ? constraint.objectIds.includes(selectedObjectId) : false
  );

  const add = (type: EditorConstraintType) => {
    if (!selectedObjectId) {
      return;
    }
    addConstraint(type, [selectedObjectId]);
  };

  return (
    <Card className="border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 shadow-sm">
      <CardHeader className="p-3 pb-0">
        <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">Constraints</h3>
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Create lightweight relation tags on selected objects.</p>
      </CardHeader>

      <CardContent className="p-3 pt-3">
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="secondary" onClick={() => add("attach")} disabled={!selectedObjectId}>
            Attach
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => add("align")} disabled={!selectedObjectId}>
            Align
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => add("offset")} disabled={!selectedObjectId}>
            Offset
          </Button>
        </div>

        <div className="mt-3 space-y-1.5">
          {selectedConstraints.length === 0 ? (
            <p className="rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5 text-[11px] text-[var(--text-tertiary)]">
              {selectedObjectId ? "No constraints on this object." : "Select an object to manage constraints."}
            </p>
          ) : (
            selectedConstraints.map((constraint) => (
              <div
                key={constraint.id}
                className="flex items-center justify-between rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5"
              >
                <div>
                  <p className="text-[11px] font-medium text-[var(--text-primary)]">{constraint.type}</p>
                  <p className="font-mono text-[10px] text-[var(--text-tertiary)]">{constraint.id}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => toggleConstraint(constraint.id)}>
                    {constraint.enabled ? "Enabled" : "Disabled"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeConstraint(constraint.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
