import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vinculum Documentation",
  description: "System-level documentation for Vinculum architecture, data flow, and reliability model."
};

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
  "Error monitoring/fallback",
  "Accessibility",
  "Current limitations",
  "Roadmap"
];

export default function DocumentationsPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-8 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <h1 className="text-[28px] font-semibold">Vinculum Documentation</h1>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
              Technical reference for architecture, data flow, safety, and operational behavior.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="rounded border border-[var(--border-strong)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
              Back to Landing
            </Link>
            <Link href="/editor" className="rounded border border-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent)]">
              Open Editor
            </Link>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="h-fit rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-4">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Contents</p>
            <ul className="space-y-1">
              {tocItems.map((item) => {
                const id = item.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                return (
                  <li key={item}>
                    <a href={`#${id}`} className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                      {item}
                    </a>
                  </li>
                );
              })}
            </ul>
          </aside>

          <article className="space-y-8">
            <Section title="What is Vinculum?">
              Vinculum is an interactive workspace for mathematical scene authoring. It combines 2D sketching and 3D visualization,
              with measurement, persistence, sharing, export, and onboarding systems designed for reliable iterative work.
            </Section>

            <Section title="Core architecture">
              The app uses a client-rendered editor shell powered by Zustand state slices and route-level Next App Router pages.
            </Section>
            <Mermaid
              title="System architecture diagram"
              code={`graph TD
  A[Next App Router] --> B[Landing /]
  A --> C[Editor /editor]
  C --> D[EditorShell]
  D --> E[TopToolbar]
  D --> F[ViewportHost]
  D --> G[Inspector + Object Browser + Bottom Panel]
  D --> H[Dialogs: Examples/Projects/Import/Recovery]
  D --> I[ThemeSync]
  I --> J[documentElement data-theme/data-accent]
  D --> K[Zustand Graph Store]
  K --> L[Scene + UI + Persistence Slices]`}
            />

            <Section title="Scene system">
              Scenes are represented as versioned documents with metadata and object arrays. Validation and migration guards run during
              import/deserialization to maintain compatibility and safety across schema evolution.
            </Section>
            <Mermaid
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

            <Section title="Object system">
              Object primitives (surfaces, planes, curves, and related graph objects) are stored in scene objects and rendered by
              dedicated 2D/3D pipelines. Object selection and inspector edits flow through store actions to keep behavior deterministic.
            </Section>

            <Section title="Measurement tools">
              Measurement features include probes, pins, distance, and angle workflows. The UI provides temporary drafts and persisted
              measurement entities while preserving scene integrity and history behavior.
            </Section>

            <Section title="Expression safety">
              Expression parsing and evaluation are constrained with safety limits and validation to prevent unstable formulas, runaway
              computations, and invalid import payloads from degrading the editing session.
            </Section>

            <Section title="Persistence model">
              Persistence combines project saves, autosave state, recovery snapshots, and theme density preferences in browser storage.
              Recovery and welcome gating logic are coordinated at editor startup.
            </Section>
            <Mermaid
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

            <Section title="Share links">
              Sharing serializes scene state to URL-safe payloads. On open, query parsing validates payloads and prompts before replacing
              non-empty work, preserving user safety and continuity.
            </Section>

            <Section title="Export pipeline">
              Export supports JSON, 2D PNG/SVG, and 3D PNG outputs with validation, fallback messaging, and controlled download triggers.
            </Section>
            <Mermaid
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

            <Section title="Performance HUD">
              The optional HUD surfaces runtime metrics (FPS/frame timing) to support diagnostics in complex scenes without impacting
              default UX for regular users.
            </Section>

            <Section title="Error monitoring/fallback">
              Viewport and export failures are isolated through boundaries and monitored reporting hooks so users can continue working
              and recover with reset/export alternatives.
            </Section>

            <Section title="Accessibility">
              Dialog focus traps, keyboard shortcuts, aria attributes, and semantic controls are applied across editor and route-level
              pages to maintain keyboard and assistive-technology compatibility.
            </Section>

            <Section title="Current limitations">
              <ul className="list-disc pl-5 text-[14px] text-[var(--text-secondary)]">
                <li>Client-side storage only; no account/cloud sync.</li>
                <li>High-complexity scenes can still impact rendering smoothness.</li>
                <li>Diagram rendering in this page uses Mermaid syntax blocks without in-app runtime renderer.</li>
              </ul>
            </Section>

            <Section title="Roadmap">
              <ul className="list-disc pl-5 text-[14px] text-[var(--text-secondary)]">
                <li>Expanded object libraries and richer constraint authoring.</li>
                <li>Improved performance profiling and scene diagnostics.</li>
                <li>Additional documentation examples for advanced workflows.</li>
              </ul>
            </Section>
            <Mermaid
              title="Tool interaction flow"
              code={`flowchart LR
  A[Tool selection] --> B[Input handling]
  B --> C[Store updates]
  C --> D[2D/3D render update]
  C --> E[Inspector + object browser sync]
  C --> F[History + autosave update]`}
            />
          </article>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section id={id} className="space-y-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-5">
      <h2 className="text-[20px] font-semibold">{title}</h2>
      <div className="text-[14px] leading-relaxed text-[var(--text-secondary)]">{children}</div>
    </section>
  );
}

function Mermaid({ title, code }: { title: string; code: string }) {
  return (
    <section className="space-y-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-5">
      <h3 className="text-[16px] font-semibold">{title}</h3>
      <pre className="overflow-x-auto rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[12px] text-[var(--text-secondary)]">
        <code>{`\`\`\`mermaid\n${code}\n\`\`\``}</code>
      </pre>
    </section>
  );
}
