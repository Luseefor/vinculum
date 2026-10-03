"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
      <section className="min-w-0">
        <header className="p-3">
          <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Object data</h3>
          <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">Select an object to inspect advanced metadata.</p>
        </header>
      </section>
    );
  }

  const serialized = JSON.stringify(selected, null, 2);

  return (
    <section className="min-w-0">
      <div className="min-w-0 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Diagnostic label="Object ID" value={selected.id} mono />
          <Diagnostic label="Kind" value={selected.kind} />
          <Diagnostic label="Visible" value={selected.visible ? "true" : "false"} />
          <Diagnostic label="Color" value={selected.color} mono />
        </div>
        <div className="py-1">
          <p className="mb-1 text-[11px] font-medium text-[var(--text-tertiary)]">Selected object JSON</p>
          <pre className="max-h-40 overflow-auto text-[11px] text-[var(--text-secondary)]">{serialized}</pre>
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
          <span role="status" className="text-[12px] text-[var(--text-secondary)]">
            {copyState === "copied" && "Copied"}
            {copyState === "failed" && "Copy failed"}
          </span>
        </div>
      </div>
    </section>
  );
}

function Diagnostic({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-sm)] bg-[var(--editor-control)] px-2 py-1.5">
      <p className="text-[11px] font-medium text-[var(--text-tertiary)]">{label}</p>
      <p className={`mt-0.5 break-words text-[12px] text-[var(--text-primary)] ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
