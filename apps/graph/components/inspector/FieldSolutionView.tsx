"use client";

import { useState } from "react";
import { MathExpression, MathText } from "@/components/math/MathExpression";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FieldSolution, SymbolicAnswer } from "@/lib/math/fieldSolutions";

const FORMULA_LATEX: Record<string, string> = {
  "L = ∫ |r′(t)| dt": String.raw`L = \int \lvert r'(t)\rvert\,dt`,
  "I = ∫ g(r(t)) |r′(t)| dt": String.raw`I = \int g(r(t))\lvert r'(t)\rvert\,dt`,
  "W = ∫ F(r(t)) · r′(t) dt": String.raw`W = \int F(r(t))\cdot r'(t)\,dt`,
  "A = ∬ |rᵤ × rᵥ| du dv": String.raw`A = \iint \lvert r_u\times r_v\rvert\,du\,dv`,
  "I = ∬ g(r(u,v)) |rᵤ × rᵥ| du dv": String.raw`I = \iint g(r(u,v))\lvert r_u\times r_v\rvert\,du\,dv`,
  "Φ = ∬ F(r(u,v)) · (rᵤ × rᵥ) du dv": String.raw`\Phi = \iint F(r(u,v))\cdot(r_u\times r_v)\,du\,dv`,
  "∇g = gᵣ eᵣ + (gθ/r) eθ": String.raw`\nabla g = g_r e_r + \frac{g_\theta}{r} e_\theta`,
  "Δg = gᵣᵣ + gᵣ/r + gθθ/r²": String.raw`\Delta g = g_{rr} + \frac{g_r}{r} + \frac{g_{\theta\theta}}{r^2}`,
  "div F = ∂Fᵣ/∂r + Fᵣ/r + (∂Fθ/∂θ)/r": String.raw`\operatorname{div} F = \frac{\partial F_r}{\partial r} + \frac{F_r}{r} + \frac{1}{r}\frac{\partial F_\theta}{\partial\theta}`,
  "curl F = ∂Fθ/∂r + Fθ/r − (∂Fᵣ/∂θ)/r": String.raw`\operatorname{curl} F = \frac{\partial F_\theta}{\partial r} + \frac{F_\theta}{r} - \frac{1}{r}\frac{\partial F_r}{\partial\theta}`,
  "ΔF = (ΔFᵣ − Fᵣ/r² − 2Fθ,θ/r²)eᵣ + (ΔFθ − Fθ/r² + 2Fᵣ,θ/r²)eθ": String.raw`\Delta F = \left(\Delta F_r-\frac{F_r}{r^2}-\frac{2F_{\theta,\theta}}{r^2}\right)e_r + \left(\Delta F_\theta-\frac{F_\theta}{r^2}+\frac{2F_{r,\theta}}{r^2}\right)e_\theta`,
  "ΔF = <ΔP, ΔQ, ΔR> (omit R in 2D)": String.raw`\Delta F = \langle\Delta P,\Delta Q,\Delta R\rangle\quad\text{(omit R in 2D)}`,
  "Unit direction = ∇g / |∇g|": String.raw`\text{Unit direction} = \frac{\nabla g}{\lvert\nabla g\rvert}`,
  "Unit direction = F / |F|": String.raw`\text{Unit direction} = \frac{F}{\lvert F\rvert}`,
  "curl F = Qₓ − Pᵧ": String.raw`\operatorname{curl} F = Q_x-P_y`,
  "curl F = <Rᵧ − Qz, Pz − Rₓ, Qₓ − Pᵧ>": String.raw`\operatorname{curl} F = \langle R_y-Q_z, P_z-R_x, Q_x-P_y\rangle`,
  "uₓ − vᵧ = 0; uᵧ + vₓ = 0": String.raw`u_x-v_y=0;\quad u_y+v_x=0`,
  "Δf = Δu + i Δv": String.raw`\Delta f = \Delta u+i\Delta v`,
  "f′(z) = uₓ + i vₓ": String.raw`f'(z)=u_x+i v_x`,
  "vᵧ = uₓ; vₓ = −uᵧ": String.raw`v_y=u_x;\quad v_x=-u_y`,
  "Solve uₓ − vᵧ = 0 and uᵧ + vₓ = 0 together": String.raw`\text{Solve }u_x-v_y=0\text{ and }u_y+v_x=0\text{ together}`,
  "x = r cos θ; y = r sin θ": String.raw`x=r\cos\theta;\quad y=r\sin\theta`,
  "dr/dθ": String.raw`\frac{dr}{d\theta}`

};

function formulaLatex(formula: string): string | undefined {
  if (FORMULA_LATEX[formula]) return FORMULA_LATEX[formula];
  if (/^(?:div F|Δg) = ∂/.test(formula)) {
    return formula.replace(/^div F/, String.raw`\operatorname{div} F`).replace(/^Δg/, String.raw`\Delta g`)
      .replace(/∂(²)?([A-Za-z])\/∂([xyz])(²)?/g, (_, numeratorPower: string, component: string, variable: string, denominatorPower: string) => String.raw`\frac{\partial${numeratorPower ? "^2" : ""} ${component}}{\partial ${variable}${denominatorPower ? "^2" : ""}}`);
  }
  return undefined;
}

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
    <p className="min-w-0 break-words"><MathText text={solution.definition} /></p>
    <p className="min-w-0 break-words"><MathExpression expression={active.formula} latex={formulaLatex(active.formula)} /></p>
    <ol className="list-decimal space-y-2 pl-5">{active.steps.map((step, index) => <li className="break-words" key={index}><MathText text={step} /></li>)}</ol>
    {active.errors.map((error) => <p key={error}>{error}</p>)}
    <div className="border-t border-[var(--border-subtle)] pt-3"><p className="font-semibold text-[var(--text-primary)]">Answer</p><p className="min-w-0 break-words" data-testid="solution-final-answer">{active.conclusion ? <MathText text={active.conclusion} /> : <MathExpression expression={formatSymbolicAnswer(active)} />}</p></div>
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
            <dt className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[var(--text-secondary)]">{answer.label}</span>
              <button type="button" aria-label={`Show ${answer.label.toLowerCase()} solution`} onClick={(event) => { event.currentTarget.focus(); setActiveLabel(answer.label); }} className="shrink-0 rounded px-1 py-1 text-[11px] text-[var(--accent-ink)] outline-none hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Show solution</button>
            </dt>
            <dd>
              <p className="min-w-0 break-words text-[12px] leading-relaxed text-[var(--text-primary)]" data-testid={`symbolic-${answer.label.toLowerCase().replaceAll(" ", "-")}`}>{answer.conclusion ? <MathText text={answer.conclusion} /> : <MathExpression expression={formatSymbolicAnswer(answer)} />}</p>
              {answer.basis ? <p className="text-[11px] text-[var(--text-tertiary)]">Basis: {answer.basis === "real, imaginary" ? answer.basis : <MathExpression expression={answer.basis} latex={answer.basis === "eᵣ, eθ" ? String.raw`e_r, e_\theta` : /^[xyz](?:, [xyz])+$/.test(answer.basis) ? answer.basis : undefined} />}</p> : null}
            </dd>
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
