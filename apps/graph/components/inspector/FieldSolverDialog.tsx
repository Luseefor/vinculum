"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEditorStore } from "@/lib/store/editorStore";
import { parametersToScope } from "@/lib/store/editorParameters";
import { solveFieldProblem, type FieldSolution } from "@/lib/math/fieldSolutions";
import { solveComplexField, solveHarmonicConjugate, splitComplexExpression } from "@/lib/math/complexFieldAnalysis";
import { solvePolarCurve } from "@/lib/math/polarFieldExpressions";
import { plotFieldProblem } from "@/lib/objects/plotFieldProblem";
import FieldSolutionView from "./FieldSolutionView";

type Problem = "vector" | "scalar" | "complex" | "conjugate" | "curve";
const presets: Record<string, string[]> = {
  "vector-cartesian-3": ["-y", "x", "0"], "vector-cartesian-2": ["-y", "x"],
  "vector-polar-2": ["r", "0"], "scalar-cartesian-3": ["x^2 + y^2 + z^2"],
  "scalar-cartesian-2": ["x^2 + y^2"], "scalar-polar-2": ["r^2"],
  "complex-components-2": ["x^2 - y^2", "2*x*y"], "complex-expression-2": ["z^2"],
  "curve-polar-2": ["2*cos(3*theta)"],
  "conjugate-cartesian-2": ["x^2 - y^2"]
};
const selectClass = "h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 text-[13px] text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export default function FieldSolverDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [problem, setProblem] = useState<Problem>("vector");
  const [coordinates, setCoordinates] = useState<"cartesian" | "polar">("cartesian");
  const [dimension, setDimension] = useState<"2" | "3">("3");
  const [complexInput, setComplexInput] = useState<"components" | "expression">("expression");
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const parameters = useEditorStore((state) => state.parameters);
  const complex = problem === "complex" || problem === "conjugate";
  const activeCoordinates = problem === "curve" ? "polar" : complex ? (problem === "complex" ? complexInput : "cartesian") : coordinates;
  const activeDimension = problem === "curve" || complex || coordinates === "polar" ? "2" : dimension;
  const profile = `${problem}-${activeCoordinates}-${activeDimension}`;
  const components = drafts[profile] ?? presets[profile]!;
  const signature = JSON.stringify([profile, components, parameters]);
  const [plotError, setPlotError] = useState<string | null>(null);
  const [plotComponent, setPlotComponent] = useState<"vector" | "real" | "imaginary" | "magnitude" | "phase">("vector");
  const [result, setResult] = useState<{ signature: string; solution: FieldSolution } | null>(null);
  useEffect(() => {
    if (!open) return;
    setPlotError(null);
    const timer = window.setTimeout(() => {
      const params = parametersToScope(parameters);
      let solution: FieldSolution;
      if (problem === "complex") {
        const pair = complexInput === "expression" ? splitComplexExpression(components[0]!, params) : { real: components[0]!, imaginary: components[1]! };
        solution = "error" in pair ? { definition: components[0]!, answers: [], notes: [], error: pair.error } : solveComplexField(pair.real, pair.imaginary, params);
      } else if (problem === "curve") solution = solvePolarCurve(components[0]!, params);
      else if (problem === "conjugate") solution = solveHarmonicConjugate(components[0]!, params);
      else solution = solveFieldProblem({ kind: problem, coordinates, components, variables: coordinates === "polar" ? ["r", "theta"] : activeDimension === "2" ? ["x", "y"] : ["x", "y", "z"], params });
      setResult({ signature, solution });
    }, 300);
    return () => window.clearTimeout(timer);
    // Signature contains all mathematical inputs, including parameter values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signature]);
  const labels = problem === "curve" ? ["Radius r(theta)"] : problem === "conjugate" ? ["Real part u(x,y)"] : problem === "complex" ? complexInput === "expression" ? ["Complex function f(z)"] : ["Real part u(x,y)", "Imaginary part v(x,y)"]
    : problem === "scalar" ? [coordinates === "polar" ? "Scalar function g(r,theta)" : `Scalar function g(${activeDimension === "2" ? "x,y" : "x,y,z"})`]
    : coordinates === "polar" ? ["Radial component Fᵣ(r,theta)", "Angular component Fθ(r,theta)"] : activeDimension === "2" ? ["P(x,y)", "Q(x,y)"] : ["P(x,y,z)", "Q(x,y,z)", "R(x,y,z)"];
  const canPlot = result?.signature === signature && !result.solution.error && !(problem === "scalar" && coordinates === "cartesian" && dimension === "3");
  const plot = () => {
    const params = parametersToScope(parameters);
    let plotInput: Parameters<typeof plotFieldProblem>[0];
    if (complex) {
      const pair = problem === "conjugate"
        ? { real: components[0]!, imaginary: result?.solution.answers.find((answer) => answer.label === "Harmonic conjugate")?.expressions[0] ?? "" }
        : complexInput === "expression" ? splitComplexExpression(components[0]!, params) : { real: components[0]!, imaginary: components[1]! };
      if ("error" in pair) { setPlotError(pair.error); return; }
      const magnitude = `sqrt((${pair.real})^2+(${pair.imaginary})^2)`;
      const expression = plotComponent === "real" ? pair.real : plotComponent === "imaginary" ? pair.imaginary : plotComponent === "magnitude" ? magnitude : `atan2((${pair.imaginary}),(${pair.real}))*(${magnitude})/(${magnitude})`;
      plotInput = { kind: plotComponent === "vector" ? "vector" : "scalar", components: plotComponent === "vector" ? [pair.real, pair.imaginary] : [expression], coordinates: "cartesian", dimension: "2", params };
    } else plotInput = { kind: problem, coordinates: problem === "curve" ? "polar" : coordinates, components, dimension: activeDimension, params };
    const plotted = plotFieldProblem(plotInput);
    if (plotted.error) setPlotError(plotted.error);
    else { setPlotError(null); onOpenChange(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[calc(100dvh-3rem)] max-w-3xl flex-col" contentTestId="field-solver-dialog">
      <DialogHeader><DialogTitle>Field solver</DialogTitle><DialogDescription>Enter a definition to solve automatically. Open a solution to see the steps.</DialogDescription></DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[12px] text-[var(--text-secondary)]">Problem<select className={selectClass} aria-label="Field problem" value={problem} onChange={(event) => setProblem(event.target.value as Problem)}>
            <option value="vector">Vector: curl, divergence, Laplacian, direction</option><option value="scalar">Scalar: gradient, Laplacian</option><option value="complex">Complex function and Cauchy–Riemann</option><option value="conjugate">Find harmonic conjugate</option><option value="curve">Polar curve</option>
          </select></label>
          {problem === "curve" ? null : complex ? problem === "complex" ? <label className="text-[12px] text-[var(--text-secondary)]">Definition<select className={selectClass} aria-label="Complex definition format" value={complexInput} onChange={(event) => setComplexInput(event.target.value as "components" | "expression")}><option value="expression">f(z)</option><option value="components">u(x,y) + i v(x,y)</option></select></label> : null
            : <label className="text-[12px] text-[var(--text-secondary)]">Coordinates<select className={selectClass} aria-label="Field coordinates" value={coordinates} onChange={(event) => setCoordinates(event.target.value as "cartesian" | "polar")}><option value="cartesian">Cartesian</option><option value="polar">Polar (r, θ)</option></select></label>}
          {!complex && problem !== "curve" && coordinates === "cartesian" ? <label className="text-[12px] text-[var(--text-secondary)]">Dimension<select className={selectClass} aria-label="Field dimension" value={dimension} onChange={(event) => setDimension(event.target.value as "2" | "3")}><option value="2">2D</option><option value="3">3D</option></select></label> : null}
        </div>
        <div className="my-4 space-y-3">{labels.map((label, index) => <label key={`${profile}-${index}`} className="block text-[12px] text-[var(--text-secondary)]">{label}<Input aria-label={label} value={components[index] ?? ""} onChange={(event) => setDrafts((previous) => ({ ...previous, [profile]: components.map((component, i) => i === index ? event.target.value : component) }))} className="mt-1 h-9 font-mono" /></label>)}</div>
        {(coordinates === "polar" || problem === "curve") && !complex ? <p className="mb-3 text-[12px] text-[var(--text-tertiary)]">Use r and theta. Angles are in radians; the polar basis requires r &gt; 0.</p> : null}
        {complex ? <label className="mb-3 block text-[12px] text-[var(--text-secondary)]">Plot<select className={selectClass} aria-label="Complex plot" value={plotComponent} onChange={(event) => setPlotComponent(event.target.value as typeof plotComponent)}><option value="vector">Associated vector field (u,v)</option><option value="real">Real part</option><option value="imaginary">Imaginary part</option><option value="magnitude">Magnitude</option><option value="phase">Phase</option></select></label> : null}
        {plotError ? <p role="alert" className="mb-3 text-[12px] text-[var(--text-secondary)]">{plotError}</p> : null}
        <FieldSolutionView embedded solution={result?.signature === signature ? result.solution : null} pending={result?.signature !== signature} />
      </div>
      <DialogFooter><Button disabled={!canPlot} onClick={plot} title={problem === "scalar" && dimension === "3" && coordinates === "cartesian" ? "Use a 2D scalar function to plot a surface" : "Add the definition to the scene"}>Add to scene</Button><Button onClick={() => onOpenChange(false)}>Close solver</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
