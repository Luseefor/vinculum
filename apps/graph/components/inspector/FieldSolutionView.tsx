"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FieldSolution, SymbolicAnswer } from "@/lib/math/fieldSolutions";

export function formatSymbolicAnswer(answer: SymbolicAnswer): string {
  if (answer.conclusion) return answer.conclusion;
  const values = answer.expressions.map((expression) => expression ?? "unavailable");
  return values.length === 1 ? values[0]! : `<${values.join(", ")}>`;
}

export default function FieldSolutionView({ solution, pending = false, embedded = false }: { solution: FieldSolution | null; pending?: boolean; embedded?: boolean }) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const active = solution?.answers.find((answer) => answer.label === activeLabel);
  if (pending) return <p role="status" className="text-[12px] text-[var(--text-tertiary)]">Solving…</p>;
  if (!solution) return null;
  if (solution.error) return <p role="status" className="text-[12px] text-[var(--text-secondary)]">{solution.error}</p>;
  const steps = active ? <>
    <p className="break-words font-mono">{solution.definition}</p>
    <p className="break-words font-mono">{active.formula}</p>
    <ol className="list-decimal space-y-2 pl-5">{active.steps.map((step, index) => <li className="break-words" key={index}>{step}</li>)}</ol>
    {active.errors.map((error) => <p key={error}>{error}</p>)}
    <div className="border-t border-[var(--border-subtle)] pt-3"><p className="font-semibold text-[var(--text-primary)]">Answer</p><p className="break-words font-mono" data-testid="solution-final-answer">{formatSymbolicAnswer(active)}</p></div>
    {solution.notes.map((note) => <p className="text-[12px] text-[var(--text-tertiary)]" key={note}>{note}</p>)}
  </> : null;
  if (embedded && active) return <section aria-label={`${active.label} solution`} className="space-y-4 text-[13px] text-[var(--text-secondary)]">
    <Button onClick={() => setActiveLabel(null)}>Back to answers</Button><h3 className="font-semibold">{active.label} solution</h3>{steps}
  </section>;
  return (
    <div className="min-w-0" data-testid="field-symbolic-solutions">
      <dl className="divide-y divide-[var(--border-subtle)]">
        {solution.answers.map((answer) => (
          <div key={answer.label} className="min-w-0 py-2">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[12px] font-medium text-[var(--text-secondary)]">{answer.label}</dt>
              <button type="button" aria-label={`Show ${answer.label.toLowerCase()} solution`} onClick={(event) => { event.currentTarget.focus(); setActiveLabel(answer.label); }} className="shrink-0 rounded px-1 py-1 text-[11px] text-[var(--accent-ink)] outline-none hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Show solution</button>
            </div>
            <dd className="break-words font-mono text-[12px] leading-relaxed text-[var(--text-primary)]" data-testid={`symbolic-${answer.label.toLowerCase().replaceAll(" ", "-")}`}>{formatSymbolicAnswer(answer)}</dd>
            {answer.basis ? <p className="text-[11px] text-[var(--text-tertiary)]">Basis: {answer.basis}</p> : null}
          </div>
        ))}
      </dl>
      <Dialog open={!!active} onOpenChange={(open) => { if (!open) setActiveLabel(null); }}>
        <DialogContent className="flex max-h-[calc(100dvh-3rem)] max-w-2xl flex-col" contentTestId="field-solution-overlay">
          <DialogHeader>
            <DialogTitle>{active?.label} solution</DialogTitle>
            <DialogDescription>Automatically derived from the current definition.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-[13px] text-[var(--text-secondary)]">
            {steps}
          </div>
          <DialogFooter><Button onClick={() => setActiveLabel(null)}>Close solution</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
