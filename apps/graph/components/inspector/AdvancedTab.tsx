"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useGraphStore } from "@/store/graphStore";

export default function AdvancedTab() {
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const selected = useMemo(
    () => objects.find((object) => object.id === selectedObjectId) ?? null,
    [objects, selectedObjectId]
  );

  if (!selected) {
    return (
      <Card className="border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 shadow-none">
        <CardHeader className="p-3">
          <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">Advanced</h3>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Select an object to inspect advanced metadata.</p>
        </CardHeader>
      </Card>
    );
  }

  const serialized = JSON.stringify(selected, null, 2);

  return (
    <Card className="border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 shadow-sm">
      <CardHeader className="p-3 pb-0">
        <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">Advanced</h3>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <Diagnostic label="Object ID" value={selected.id} mono />
          <Diagnostic label="Kind" value={selected.kind} />
          <Diagnostic label="Visible" value={selected.visible ? "true" : "false"} />
          <Diagnostic label="Color" value={selected.color} mono />
        </div>
        <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-2">
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Selected object JSON</p>
          <pre className="max-h-40 overflow-auto text-[10px] text-[var(--text-secondary)]">{serialized}</pre>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(serialized);
                setCopyState("copied");
                setTimeout(() => setCopyState("idle"), 2000);
              } catch {
                setCopyState("failed");
                setTimeout(() => setCopyState("idle"), 2000);
              }
            }}
          >
            Copy JSON
          </Button>
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {copyState === "copied" && "Copied"}
            {copyState === "failed" && "Copy failed"}
            {copyState === "idle" && "Export selected object payload"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function Diagnostic({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">{label}</p>
      <p className={`mt-0.5 text-[11px] text-[var(--text-primary)] ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
