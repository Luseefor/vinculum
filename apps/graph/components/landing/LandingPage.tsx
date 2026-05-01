"use client";

import Image from "next/image";
import Link from "next/link";
import ThemeSync from "@/components/theme/ThemeSync";
import { MoonIcon, SunIcon } from "@/components/layout/icons";
import { useGraphStore } from "@/store/graphStore";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { useState } from "react";
import ThemeAccentPopover from "@/components/theme/ThemeAccentPopover";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function LandingPage() {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const resolvedTheme = useResolvedTheme();

  return (
    <main className="min-h-screen max-h-screen overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <ThemeSync />
      <div className="mx-auto flex w-full max-w-[1200px] flex-col px-6 py-8 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-3">
            <Image src="/brand/logo_horizontal.png" alt="Vinculum" width={150} height={26} className="h-6 w-auto" priority />
            <span className="text-[12px] uppercase tracking-wide text-[var(--text-tertiary)]">Mathematical Workspace</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Popover open={themeMenuOpen} onOpenChange={setThemeMenuOpen}>
              <PopoverTrigger>
                {(props) => (
                  <button
                    ref={props.ref as any}
                    type="button"
                    onClick={props.onClick}
                    onKeyDown={props.onKeyDown}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-[var(--border-strong)] px-2.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    aria-label={`Open appearance menu. Current ${resolvedTheme}.`}
                    aria-expanded={props["aria-expanded"]}
                    aria-controls={props["aria-controls"]}
                    aria-haspopup={props["aria-haspopup"]}
                  >
                    {resolvedTheme === "dark" ? <MoonIcon className="h-3.5 w-3.5" /> : <SunIcon className="h-3.5 w-3.5" />}
                    {resolvedTheme === "dark" ? "Dark" : "Light"}
                  </button>
                )}
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <ThemeAccentPopover showPerformance={false} />
              </PopoverContent>
            </Popover>
            <Link href="/documentations" className="rounded border border-[var(--border-strong)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
              Open Documentation
            </Link>
            <Link href="/editor" className="rounded border border-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent)]">
              Open Editor
            </Link>
          </div>
        </header>
        <section className="grid gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-start">
          <div className="space-y-6 pt-2">
            <h1 className="text-[36px] font-bold leading-tight tracking-tight sm:text-[44px] lg:text-[52px]">
              Interactive mathematical scenes, from sketch to share.
            </h1>
            <p className="max-w-xl text-[16px] leading-relaxed text-[var(--text-secondary)]">
              Vinculum combines 2D sketching and 3D visualization in one editor with projects, examples, autosave,
              and export tools ready to use.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/editor" className="rounded bg-[var(--accent)] px-5 py-3 text-[14px] font-semibold text-white">
                Open Editor
              </Link>
              <Link href="/editor?examples=1" className="rounded border border-[var(--border-strong)] px-5 py-3 text-[14px] font-semibold text-[var(--text-secondary)]">
                Open Examples
              </Link>
              <Link href="/documentations" className="rounded border border-[var(--border-strong)] px-5 py-3 text-[14px] font-semibold text-[var(--text-secondary)]">
                Open Documentation
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--bg-tertiary)]">
            <div className="flex h-9 items-center justify-between border-b border-[var(--border-subtle)] px-3 text-[11px] text-[var(--text-tertiary)]">
              <span className="font-semibold text-[var(--accent)]">Vinculum Editor Preview</span>
              <span>2D/3D · Scene · Inspector</span>
            </div>
            <div className="aspect-[16/10] min-h-[280px] bg-[var(--bg-primary)]">
              <div className="grid h-full grid-rows-[30px_1fr_24px]">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 text-[11px] text-[var(--text-tertiary)]">
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-[var(--border-subtle)] px-1.5 py-0.5">Scene</span>
                    <span className="rounded border border-[var(--border-subtle)] px-1.5 py-0.5">Export</span>
                  </div>
                  <span className="font-mono text-[var(--text-secondary)]">Measure Distance</span>
                  <span className="rounded border border-[var(--border-subtle)] px-1.5 py-0.5">Theme</span>
                </div>

                <div className="grid grid-cols-[22%_54%_24%]">
                  <aside className="border-r border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-2">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Scene</p>
                    <div className="space-y-1 text-[11px] text-[var(--text-secondary)]">
                      <p>Surface #1</p>
                      <p>Curve #2</p>
                      <p>Plane #3</p>
                      <p className="text-[var(--accent)]">Distance 3.2140 u</p>
                    </div>
                  </aside>

                  <div className="relative border-r border-[var(--border-subtle)] bg-[var(--surface-canvas)]">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.16)_1px,transparent_1px)] bg-[size:28px_28px]" />
                    <svg viewBox="0 0 720 450" className="absolute inset-0 h-full w-full">
                      <polyline
                        fill="none"
                        stroke="#60a5fa"
                        strokeWidth="2.4"
                        points="36,290 116,260 192,220 272,240 360,186 438,168 528,142 676,164"
                      />
                      <line x1="220" y1="330" x2="486" y2="198" stroke="#f97316" strokeWidth="2.4" />
                      <circle cx="220" cy="330" r="4.5" fill="#f97316" />
                      <circle cx="486" cy="198" r="4.5" fill="#f97316" />
                    </svg>
                    <div className="absolute left-3 top-3 rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 text-[11px]">
                      <span className="text-[#f97316]">Probe</span> XY mode
                    </div>
                    <div className="absolute left-[58%] top-[56%] -translate-x-1/2 -translate-y-1/2 rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-[11px] text-[var(--text-primary)]">
                      3.2140 u
                    </div>
                  </div>

                  <aside className="bg-[var(--bg-tertiary)] px-2 py-2">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Inspector</p>
                    <div className="space-y-2 text-[11px] text-[var(--text-secondary)]">
                      <p>Expression</p>
                      <div className="rounded border border-[var(--border-subtle)] px-2 py-1 font-mono text-[11px] text-[#60a5fa]">
                        z = sin(x) * cos(y)
                      </div>
                      <p>Resolution</p>
                      <div className="h-2 rounded bg-[var(--surface-muted)]">
                        <div className="h-2 w-3/5 rounded bg-[#f97316]" />
                      </div>
                    </div>
                  </aside>
                </div>

                <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 text-[11px] text-[var(--text-tertiary)]">
                  <span>Objects 3</span>
                  <span className="font-mono">Snap ON · 0.25</span>
                  <span>Saved</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--border-subtle)] py-12">
          <h2 className="mb-5 text-[24px] font-semibold">Core capabilities</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["3D surfaces", "Model explicit and implicit surfaces with direct expression input."],
              ["2D sketching", "Sketch trajectories and convert strokes into editable geometry."],
              ["Measurements", "Pin coordinates and capture distance and angle values."],
              ["Projects and autosave", "Keep work safe with local projects and automatic recovery."],
              ["Share links", "Send reproducible scene states through URL encoding."],
              ["Export pipeline", "Export JSON, 2D PNG/SVG, and 3D PNG outputs."]
            ].map(([title, description]) => (
              <div key={title} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-4">
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-[var(--border-subtle)] py-12">
          <h2 className="mb-5 text-[24px] font-semibold">Workflow</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["1. Start", "Open a blank scene or load an example."],
              ["2. Build", "Create objects and tune parameters in the inspector."],
              ["3. Inspect", "Measure distances and angles directly in viewports."],
              ["4. Deliver", "Save, share links, or export scene outputs."]
            ].map(([title, text]) => (
              <div key={title} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</p>
                <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-[var(--border-subtle)] py-12">
          <h2 className="mb-5 text-[24px] font-semibold">Safety and reliability</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-4 text-[14px] text-[var(--text-secondary)]">
              Expression safety limits and validation guards keep calculations stable.
            </div>
            <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-4 text-[14px] text-[var(--text-secondary)]">
              Scene schema validation, migration, autosave, and recovery protect in-progress work.
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--border-subtle)] py-12">
          <div className="flex flex-col items-start justify-between gap-4 rounded border border-[var(--border-strong)] bg-[var(--bg-tertiary)] p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-[22px] font-semibold">Ready to build your next scene?</h2>
              <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Open the editor and continue with a stable production workspace.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/editor" className="rounded bg-[var(--accent)] px-5 py-2.5 text-[14px] font-semibold text-white">
                Open Editor
              </Link>
              <Link href="/editor?examples=1" className="rounded border border-[var(--border-strong)] px-5 py-2.5 text-[14px] font-semibold text-[var(--text-secondary)]">
                Browse Examples
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
