"use client";

export default function AppearanceTab() {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 p-3">
      <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">Appearance</h3>
      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
        Dedicated appearance-only controls are planned in a later checkpoint. Use Properties for now.
      </p>
    </section>
  );
}
