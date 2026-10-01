"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import ThemeSync from "@/components/theme/ThemeSync";
import {
  ArrowRightIcon,
  ConnectorIcon,
  CubeIcon,
  CursorArrowIcon,
  DownloadIcon,
  LockIcon,
  MoonIcon,
  ShareIcon,
  SlidersIcon,
  SunIcon,
  VinculumMark
} from "@/components/layout/icons";
import { useGraphStore } from "@/store/graphStore";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { captureEvent } from "@/lib/analytics/posthog";
import { cn } from "@/components/ui/styles";

const FEATURES: Array<{ title: string; description: string; icon: ReactNode }> = [
  {
    title: "Surfaces in 3D",
    description: "Explicit, implicit, and parametric surfaces rendered live as you type the expression.",
    icon: <CubeIcon className="h-5 w-5" />
  },
  {
    title: "2D sketching",
    description: "Sketch trajectories on any plane and convert strokes into editable parametric curves.",
    icon: <ConnectorIcon className="h-5 w-5" />
  },
  {
    title: "Analysis built in",
    description: "Tangents, normals, gradients, divergence, curl, integrals, and flux — derived from the definition.",
    icon: <SlidersIcon className="h-5 w-5" />
  },
  {
    title: "Measurements",
    description: "Pin coordinates, measure distances and angles directly in the viewport.",
    icon: <CursorArrowIcon className="h-5 w-5" />
  },
  {
    title: "Share links",
    description: "Send a reproducible scene state as a single URL. No account required.",
    icon: <ShareIcon className="h-5 w-5" />
  },
  {
    title: "Export anywhere",
    description: "Scene JSON, 2D PNG and SVG, and 3D PNG from the same editor.",
    icon: <DownloadIcon className="h-5 w-5" />
  }
];

const STEPS: Array<[string, string]> = [
  ["Start", "Open a blank scene or pick one of the curated examples."],
  ["Build", "Add surfaces, curves, points, and fields. Tune them in the inspector."],
  ["Explore", "Switch between 2D, 3D, split, and quad views. Measure and analyze."],
  ["Share", "Autosave locally, then share a link or export the result."]
];

function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const resolvedTheme = useResolvedTheme();
  const setThemeMode = useGraphStore((state) => state.setThemeMode);

  useEffect(() => setMounted(true), []);

  const option = (value: "light" | "dark", label: string, icon: ReactNode) => {
    const active = mounted && resolvedTheme === value;
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={() => setThemeMode(value)}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
          active
            ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-[var(--shadow-control)]"
            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        )}
      >
        {icon}
      </button>
    );
  };

  return (
    <div role="group" aria-label="Theme" className="flex h-8 items-center gap-0.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-0.5">
      {option("light", "Light theme", <SunIcon className="h-3.5 w-3.5" />)}
      {option("dark", "Dark theme", <MoonIcon className="h-3.5 w-3.5" />)}
    </div>
  );
}

export default function LandingPage() {
  useEffect(() => {
    captureEvent("landing_viewed");
  }, []);

  const openEditor = () => captureEvent("landing_open_editor_clicked");
  const openExamples = () => captureEvent("landing_open_examples_clicked");
  const openDocs = () => captureEvent("landing_open_documentation_clicked");

  return (
    <main className="h-screen overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <ThemeSync />

      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-primary)_82%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2 rounded-[var(--radius-sm)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
            <VinculumMark className="h-7 w-7 text-[var(--text-primary)]" />
            <span className="text-[16px] font-semibold tracking-tight">Vinculum</span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            <a href="#features" className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[14px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
              Features
            </a>
            <a href="#workflow" className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[14px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
              Workflow
            </a>
            <Link href="/documentations" onClick={openDocs} className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[14px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
              Documentation
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/editor"
              onClick={openEditor}
              className="btn btn-primary h-9 gap-1.5 rounded-full px-4 text-[14px]"
            >
              Open editor
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_srgb,var(--accent-primary)_14%,transparent),transparent)]"
        />
        <div className="relative mx-auto flex w-full max-w-[1200px] flex-col items-center px-6 pb-16 pt-20 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1 text-[13px] text-[var(--text-secondary)] shadow-[var(--shadow-control)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
            2D and 3D mathematical workspace
          </span>
          <h1 className="mt-6 max-w-[860px] text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[56px] lg:text-[68px]">
            Math you can see, shape, and share.
          </h1>
          <p className="mt-6 max-w-[620px] text-[17px] leading-relaxed text-[var(--text-secondary)] sm:text-[18px]">
            Type an equation and watch it become a surface. Sketch in 2D, explore in 3D, analyze with built-in
            calculus tools, and share the exact scene with a link.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/editor" onClick={openEditor} className="btn btn-primary h-11 gap-2 rounded-full px-6 text-[15px]">
              Open the editor
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/editor?examples=1"
              onClick={openExamples}
              className="btn btn-secondary h-11 rounded-full px-6 text-[15px] shadow-[var(--shadow-control)]"
            >
              Browse examples
            </Link>
          </div>
          <p className="mt-5 text-[13px] text-[var(--text-tertiary)]">Runs in your browser · No account · Autosaves locally</p>
        </div>

        <div className="relative mx-auto w-full max-w-[1200px] px-6 pb-20">
          <div className="overflow-hidden rounded-[20px] border border-[var(--border-strong)] bg-[var(--surface-raised)] p-1.5 shadow-[0_40px_80px_-32px_rgba(15,23,42,0.35),0_12px_32px_-16px_rgba(15,23,42,0.18)]">
            <div className="overflow-hidden rounded-[15px] border border-[var(--border-subtle)]">
              <Image
                src="/landing/editor-light.jpg"
                alt="The Vinculum editor showing an object list, a 3D surface, and the inspector"
                width={1440}
                height={900}
                priority
                className="theme-light-only h-auto w-full"
              />
              <Image
                src="/landing/editor-dark.jpg"
                alt="The Vinculum editor in dark theme"
                width={1440}
                height={900}
                loading="eager"
                className="theme-dark-only h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-20 border-t border-[var(--border-subtle)] bg-[var(--editor-shell)]">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-24">
          <div className="max-w-[640px]">
            <p className="text-[14px] font-medium text-[var(--accent-ink)]">Features</p>
            <h2 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[40px]">
              Everything you need to think visually.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--text-secondary)]">
              One editor for geometry and calculus, with a single canonical scene behind every view.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-control)] transition-shadow duration-[var(--motion-normal)] hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                  {feature.icon}
                </div>
                <h3 className="mt-5 text-[16px] font-semibold">{feature.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-20 border-t border-[var(--border-subtle)]">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-24">
          <div className="max-w-[640px]">
            <p className="text-[14px] font-medium text-[var(--accent-ink)]">Workflow</p>
            <h2 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[40px]">
              From first idea to shared scene.
            </h2>
          </div>
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], index) => (
              <li key={title} className="border-t border-[var(--border-strong)] pt-5">
                <span className="text-[13px] font-medium tabular-nums text-[var(--text-tertiary)]">0{index + 1}</span>
                <p className="mt-2 text-[17px] font-semibold">{title}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">{text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-20 grid gap-4 md:grid-cols-2">
            {[
              ["Stable by design", "Expression safety limits and validation guards keep every calculation bounded."],
              ["Your work stays safe", "Schema validation, migration, autosave, and recovery protect in-progress scenes."]
            ].map(([title, text]) => (
              <div key={title} className="flex gap-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                  <LockIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[16px] font-semibold">{title}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--text-secondary)]">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-6 rounded-[28px] border border-[var(--border-subtle)] bg-[radial-gradient(80%_120%_at_50%_0%,color-mix(in_srgb,var(--accent-primary)_12%,var(--surface-raised)),var(--surface-raised))] px-6 py-16 text-center">
          <h2 className="max-w-[640px] text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">
            Ready to build your next scene?
          </h2>
          <p className="max-w-[520px] text-[16px] text-[var(--text-secondary)]">
            Start from a blank canvas or one of the examples. Everything runs locally in your browser.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/editor" onClick={openEditor} className="btn btn-primary h-11 gap-2 rounded-full px-6 text-[15px]">
              Open the editor
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/documentations"
              onClick={openDocs}
              className="btn btn-secondary h-11 rounded-full px-6 text-[15px] shadow-[var(--shadow-control)]"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center justify-between gap-4 px-6 py-8 text-[13px] text-[var(--text-tertiary)] sm:flex-row">
          <div className="flex items-center gap-2">
            <VinculumMark className="h-5 w-5 text-[var(--text-primary)]" />
            <span className="font-medium text-[var(--text-secondary)]">Vinculum</span>
          </div>
          <nav aria-label="Footer" className="flex items-center gap-5">
            <Link href="/editor" onClick={openEditor} className="hover:text-[var(--text-primary)]">
              Editor
            </Link>
            <Link href="/editor?examples=1" onClick={openExamples} className="hover:text-[var(--text-primary)]">
              Examples
            </Link>
            <Link href="/documentations" onClick={openDocs} className="hover:text-[var(--text-primary)]">
              Documentation
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
