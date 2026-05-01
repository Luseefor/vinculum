"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import MermaidDiagram from "@/components/documentation/MermaidDiagram";
import ThemeSync from "@/components/theme/ThemeSync";
import ThemeAccentPopover from "@/components/theme/ThemeAccentPopover";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { MoonIcon, SunIcon } from "@/components/layout/icons";

const tocItems = [
  "What is Vinculum?",
  "Core architecture",
  "Scene system",
  "Object system",
  "Measurement tools",
  "Expression safety",
  "Persistence model",
  "Share links",
  "Export pipeline",
  "Performance HUD",
  "Error monitoring and fallback",
  "Accessibility",
  "Current limitations",
  "Roadmap"
];

function Callout({ title, children, type = "info" }: { title: string, children: ReactNode, type?: "info" | "warning" }) {
  const isWarn = type === "warning";
  return (
    <div className={`my-6 rounded-lg border p-4 ${isWarn ? "border-amber-500/20 bg-amber-500/5 text-amber-900 dark:text-amber-200" : "border-blue-500/20 bg-[var(--accent-soft)] text-[var(--accent)] dark:text-blue-300"}`}>
      <p className={`mb-1 font-semibold ${isWarn ? "text-amber-700 dark:text-amber-500" : "text-[var(--accent)]"}`}>{title}</p>
      <div className="text-[14px] leading-relaxed opacity-90">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section id={id} className="scroll-mt-24 border-b border-[var(--border-subtle)] py-10 last:border-0">
      <h2 className="mb-5 text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-[var(--text-secondary)]">{children}</div>
    </section>
  );
}

export default function DocumentationClientPage() {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const resolvedTheme = useResolvedTheme();

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <ThemeSync />
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-10 px-6 py-10 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
          <div>
            <h1 className="text-[32px] font-semibold tracking-tight">Vinculum Documentation</h1>
            <p className="mt-2 text-[15px] text-[var(--text-secondary)]">
              Technical reference for architecture, data flow, safety, and operational behavior.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Popover open={themeMenuOpen} onOpenChange={setThemeMenuOpen}>
              <PopoverTrigger>
                {(props) => (
                  <button
                    ref={props.ref as any}
                    type="button"
                    onClick={props.onClick}
                    onKeyDown={props.onKeyDown}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-strong)] px-2.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors"
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

            <Link href="/" className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]">
              Back to Landing
            </Link>
            <Link href="/editor" className="rounded-md bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90">
              Open Editor
            </Link>
          </div>
        </header>

        <div className="grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)] items-start">
          <aside className="sticky top-10 hidden lg:block rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-5 shadow-sm">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Table of Contents</p>
            <ul className="space-y-2">
              {tocItems.map((item) => {
                const id = item.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                return (
                  <li key={item}>
                    <a href={`#${id}`} className="block text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]">
                      {item}
                    </a>
                  </li>
                );
              })}
            </ul>
          </aside>

          <article className="min-w-0 pb-20">
            <Section title="What is Vinculum?">
              <p>
                Vinculum is an interactive workspace for mathematical scene authoring. It combines 2D sketching and 3D visualization,
                with measurement, persistence, sharing, export, and onboarding systems designed for reliable iterative work.
              </p>
              <p>
                The application emphasizes determinism, separating viewports while syncing selections and mutations back to a central state store.
              </p>
            </Section>

            <Section title="Core architecture">
              <p>
                The application relies on the <strong>Next.js App Router</strong> for routing, keeping <code>/</code>, <code>/editor</code>, and <code>/documentations</code> physically separated.
                The <code>EditorShell</code> component orchestrates the workspace, while <strong>Zustand stores</strong> act as the central source of truth for the entire visual application.
              </p>
              <p>
                The 2D and 3D viewports run independently, listening to the shared Zustand state but never communicating directly with each other. This decoupled approach prevents circular updates and makes the UI responsive.
              </p>
              <MermaidDiagram
                title="System architecture diagram"
                code={`graph TD
  A[Next App Router] --> B[Landing /]
  A --> C[Editor /editor]
  C --> D[EditorShell]
  D --> E[TopToolbar]
  D --> F[ViewportHost: 2D/3D separation]
  D --> G[Inspector + Object Browser + Bottom Panel]
  D --> H[Dialogs: Examples/Projects/Import/Recovery]
  D --> I[ThemeSync]
  I --> J[documentElement data-theme/data-accent]
  D --> K[Zustand Graph Store]
  K --> L[Scene + UI + Persistence Slices]`}
              />
            </Section>

            <Section title="Scene system">
              <p>
                Scenes are represented as versioned documents containing metadata and arrays of mathematical objects.
                Validation and migration guards run continuously during import, loading, and hydration processes. This guarantees schema compatibility across different versions of the application.
              </p>
              <p>
                Every change in the viewport or inspector translates into an explicit store action, making history (Undo/Redo) extremely reliable.
              </p>
              <MermaidDiagram
                title="Scene data flow"
                code={`flowchart LR
  A[User action] --> B[Graph Store update]
  B --> C[Scene snapshot]
  C --> D[Viewport render 2D/3D]
  C --> E[History push/undo-redo]
  C --> F[Autosave scheduling]
  G[Import JSON] --> H[Deserialize + Validate + Migrate]
  H --> B`}
              />
            </Section>

            <Section title="Object system">
              <p>
                Object primitives (surfaces, planes, curves, and related graph objects) are stored inside the scene state. They contain parametric formulas, color information, and visibility flags.
              </p>
              <p>
                Dedicated 2D and 3D pipelines parse the object configurations. 3D uses Three.js, whereas 2D renders directly on HTML5 Canvas. Object selection and inspector edits flow strictly through state actions.
              </p>
            </Section>

            <Section title="Measurement tools">
              <p>
                The editor includes measurement tools designed for precise scene investigation:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Pins</strong>: Annotate specific XYZ coordinates in 3D or XY in 2D.</li>
                <li><strong>Distance</strong>: Measure Euclidean distance between two selected points.</li>
                <li><strong>Angle</strong>: Measure the angle formed by three intersecting points.</li>
              </ul>
              <p>
                The UI maintains temporary &quot;draft&quot; states while drawing a measurement, and then pushes a finalized entity to the scene graph upon completion, integrating cleanly into the history system.
              </p>
            </Section>

            <Section title="Expression safety">
              <p>
                Expression parsing uses mathjs under the hood. To protect the editor from crashing, execution is aggressively sandboxed.
              </p>
              <Callout title="Safety Constraints" type="warning">
                Mathematical evaluations are heavily constrained. High-complexity computations, recursive logic, or runaway variables will be truncated to prevent hanging the main thread.
                Invalid import payloads attempting to bypass these limits will be sanitized.
              </Callout>
            </Section>

            <Section title="Persistence model">
              <p>
                Persistence spans <code>localStorage</code> and <code>sessionStorage</code> to deliver autosave and active recovery:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Autosave</strong>: The autosave controller captures work-in-progress snapshots on a timed debounce.</li>
                <li><strong>Named Projects</strong>: Users can explicitly save and manage local projects.</li>
                <li><strong>Recovery</strong>: Unnamed states are recovered upon boot. If an editor crash or accidental close occurs, a recovery dialog asks the user if they wish to restore the lost snapshot.</li>
              </ul>
              <MermaidDiagram
                title="Persistence flow"
                code={`flowchart TD
  A[Scene changes] --> B[Autosave controller]
  B --> C{Named project?}
  C -- Yes --> D[Save project snapshot]
  C -- No --> E[Save unnamed recovery snapshot]
  F[Editor boot] --> G[Hydrate store preferences]
  G --> H[Check recovery snapshot]
  H --> I[Recovery dialog if needed]`}
              />
            </Section>

            <Section title="Share links">
              <p>
                To support seamless collaboration, entire scenes can be serialized and compressed into the URL query parameters.
              </p>
              <p>
                When a shared link is opened, the query parsing layer deserializes the payload, validates it against the current schema version, and prompts the user before overwriting their active scene.
              </p>
              <Callout title="Share Link Limits" type="warning">
                Because URLs have practical length limits across different browsers, incredibly complex scenes with hundreds of objects may fail to share via URL. In such cases, JSON export is the fallback.
              </Callout>
            </Section>

            <Section title="Export pipeline">
              <p>
                The export system allows users to extract their scenes as static data or images:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>JSON Export</strong>: Downloads the full serialized scene object.</li>
                <li><strong>2D PNG / SVG</strong>: Captures the HTML5 Canvas output or builds an SVG string representing the active graph layout.</li>
                <li><strong>3D PNG</strong>: Instructs the Three.js WebGLRenderer to trigger an immediate read-back of its draw buffer.</li>
              </ul>
              <MermaidDiagram
                title="Export flow"
                code={`flowchart LR
  A[Export action] --> B{Mode}
  B -- JSON --> C[serialize scene]
  B -- 2D PNG/SVG --> D[capture 2D viewport or build SVG]
  B -- 3D PNG --> E[capture 3D canvas]
  C --> F[trigger download]
  D --> F
  E --> F
  F --> G[status feedback]`}
              />
            </Section>

            <Section title="Performance HUD">
              <p>
                For technical debugging or measuring complex scene loads, a built-in Performance HUD tracks FPS and frame timing metrics. It operates as an overlay and is disabled by default to keep the UI clean.
              </p>
            </Section>

            <Section title="Error monitoring and fallback">
              <p>
                Robust Error Boundaries wrap the viewports, meaning an invalid 3D rendering instruction will not crash the surrounding UI controls. The editor shell remains accessible, allowing users to export their JSON data and attempt a manual reset without losing their work completely.
              </p>
            </Section>

            <Section title="Accessibility">
              <p>
                Extensive care is taken to ensure keyboard and screen-reader usability. Dialog focus traps, Aria tags, semantic elements, and keyboard shortcuts allow for quick and accessible navigation throughout the workspace.
              </p>
            </Section>

            <Section title="Current limitations">
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li><strong>Local Only</strong>: All projects and settings remain strictly client-side. No account or cloud synchronization infrastructure is implemented.</li>
                <li><strong>Performance Dropoffs</strong>: Extreme volumetric complexities will slow down rendering smoothly in standard web environments, despite memoization.</li>
                <li><strong>Share Size</strong>: Large projects must be shared via JSON; URL sharing is strictly limited by browser payload size capabilities.</li>
              </ul>
            </Section>

            <Section title="Roadmap">
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Expanded object libraries and richer constraint authoring (e.g., implicit equations).</li>
                <li>Improved performance profiling tools and scene diagnostics.</li>
                <li>Cloud syncing functionality via an optional auth layer.</li>
              </ul>
              <MermaidDiagram
                title="Tool interaction flow"
                code={`flowchart LR
  A[Tool selection] --> B[Input handling]
  B --> C[Store updates]
  C --> D[2D/3D render update]
  C --> E[Inspector + object browser sync]
  C --> F[History + autosave update]`}
              />
            </Section>
          </article>
        </div>
      </div>
    </main>
  );
}
