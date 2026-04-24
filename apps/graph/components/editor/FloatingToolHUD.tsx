"use client";

interface FloatingToolHUDProps {
  modeLabel: string;
  toolLabel: string;
  selectedId: string | null;
}

export default function FloatingToolHUD({ modeLabel, toolLabel, selectedId }: FloatingToolHUDProps) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/90 px-2 py-1 text-[10px] text-[var(--text-secondary)] shadow-[var(--shadow-panel)]">
      <span className="font-semibold text-[var(--text-primary)]">{modeLabel}</span>
      <span>·</span>
      <span>{toolLabel}</span>
      {selectedId ? (
        <>
          <span>·</span>
          <span className="font-mono text-[var(--text-tertiary)]">{selectedId.slice(0, 8)}</span>
        </>
      ) : null}
    </div>
  );
}
