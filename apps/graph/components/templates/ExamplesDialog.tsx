"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SceneExampleDefinition } from "@/lib/templates/examplesRegistry";

interface ExamplesDialogProps {
  open: boolean;
  examples: SceneExampleDefinition[];
  error: string | null;
  onClose: () => void;
  onOpenExample: (exampleId: string) => void;
}

export default function ExamplesDialog({ open, examples, error, onClose, onOpenExample }: ExamplesDialogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  useEffect(() => {
    if (!open) { setSearch(""); setCategory("all"); }
  }, [open]);
  const categories = Array.from(new Set(examples.map(example => example.category)));
  const query = search.trim().toLowerCase();
  const filtered = examples.filter(example =>
    (category === "all" || example.category === category) &&
    `${example.title} ${example.description} ${example.category}`.toLowerCase().includes(query)
  );

  return (
    <Dialog open={open} onOpenChange={nextOpen => !nextOpen && onClose()}>
      <DialogContent className="flex max-w-2xl flex-col overflow-hidden rounded-[var(--radius-xl)] border-[var(--border-subtle)]" contentTestId="examples-gallery">
        <DialogHeader className="shrink-0 border-0 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-base">Examples</DialogTitle>
              <DialogDescription className="text-xs text-[var(--text-secondary)]">Choose a scene to explore, then edit its equations.</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Close examples" onClick={onClose}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex shrink-0 flex-col gap-2 px-5 pb-4 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search examples</span>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search examples" data-autofocus="true" className="editor-control h-11 w-full rounded-[var(--radius-md)] border border-transparent bg-[var(--surface-muted)] pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" />
          </label>
          <label className="min-w-0 sm:w-48">
            <span className="sr-only">Example topic</span>
            <select value={category} onChange={event => setCategory(event.target.value)} className="editor-control h-11 w-full rounded-[var(--radius-md)] border border-transparent bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
              <option value="all">All topics</option>
              {categories.map(topic => <option key={topic} value={topic}>{topic}</option>)}
            </select>
          </label>
        </div>

        {error && <p role="alert" className="mx-5 mb-3 shrink-0 rounded-[var(--radius-md)] bg-[var(--status-error-bg)] p-3 text-sm text-[var(--status-error-fg)]">{error}</p>}
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-5">
          {filtered.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2" aria-label="Example scenes">
              {filtered.map(example => (
                <li key={example.id} className="min-w-0">
                  <button type="button" onClick={() => onOpenExample(example.id)} aria-label={`Open example: ${example.title}`} className="editor-control group flex h-full w-full items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-muted)] p-4 text-left hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]"><span>{example.category}</span><span className="shrink-0">{example.recommendedMode.toUpperCase()}</span></div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{example.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{example.description}</p>
                    </div>
                    <svg viewBox="0 0 24 24" className="mt-7 h-4 w-4 shrink-0 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-10 text-center">
              <p role="status" className="text-sm text-[var(--text-secondary)]">{examples.length === 0 ? "No examples are available." : "No examples match your search."}</p>
              {examples.length > 0 && <Button variant="secondary" className="mt-3 h-11" onClick={() => { setSearch(""); setCategory("all"); }}>Clear filters</Button>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
