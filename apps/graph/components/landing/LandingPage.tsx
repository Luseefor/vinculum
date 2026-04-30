import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col px-6 py-8 lg:px-8">
        <header className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-3">
            <Image src="/brand/logo_horizontal.png" alt="Vinculum" width={150} height={26} className="h-6 w-auto" priority />
            <span className="text-[12px] uppercase tracking-wide text-[var(--text-tertiary)]">Mathematical Workspace</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/editor" className="rounded border border-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent)]">
              Open Editor
            </Link>
          </div>
        </header>

        <section className="grid gap-10 py-20 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <h1 className="text-[40px] font-bold leading-tight tracking-tight sm:text-[48px]">
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
              <Link href="/examples" className="rounded border border-[var(--border-strong)] px-5 py-3 text-[14px] font-semibold text-[var(--text-secondary)]">
                Open Examples
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-tertiary)] p-5">
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">Quick start</p>
            <ol className="mt-4 space-y-3 text-[14px] text-[var(--text-secondary)]">
              <li>1. Open an example to start fast.</li>
              <li>2. Add or edit objects in the scene and inspector panels.</li>
              <li>3. Save, share links, or export outputs from the Scene menu.</li>
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}
