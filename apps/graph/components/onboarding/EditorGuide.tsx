"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface EditorGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowObjects: () => void;
  onShowInspector: () => void;
  onOpenSolver: () => void;
  onOpenExamples: () => void;
}

export default function EditorGuide({ open, onOpenChange, onShowObjects, onShowInspector, onOpenSolver, onOpenExamples }: EditorGuideProps) {
  const tasks = [
    {
      title: "Add and edit objects",
      location: "Objects button → Add",
      description: "Type a Cartesian equation in the blank input: x=y^2 plots in 2D; add z for 3D. Use Add for points, fields, or parametric graphs. Click a row to edit it.",
      action: "Show Objects",
      run: onShowObjects
    },
    {
      title: "Change properties or analyze",
      location: "Select an object → Inspector → Analyze",
      description: "Edit contains the expression and plot range. Analyze contains derivatives, vector calculus, integrals, and worked solutions. Settings contains appearance and object tools.",
      action: "Show Inspector",
      run: onShowInspector
    },
    {
      title: "Solve a field problem",
      location: "Math Lab → Solve",
      description: "Enter a scalar, vector, polar, or complex field. Results include gradient, divergence, curl, Laplacian, and Cauchy–Riemann checks. Use Show solution for the steps.",
      action: "Start solving",
      run: onOpenSolver
    },
    {
      title: "Learn with a ready-made scene",
      location: "Scene / More actions → Open example",
      description: "Open a surface, curve, or field example and edit it. Your current scene is replaced only after confirmation when needed.",
      action: "Browse examples",
      run: onOpenExamples
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-3rem)] max-w-2xl flex-col" contentTestId="editor-guide">
        <DialogHeader className="shrink-0">
          <DialogTitle>Editor guide</DialogTitle>
          <DialogDescription>Choose a task below. Help is always available in the top bar.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <ol className="space-y-5">
            {tasks.map((task, index) => (
              <li key={task.title} className="flex gap-3">
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[12px] font-semibold text-[var(--accent-ink)]">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{task.title}</h3>
                  <p className="mt-1 text-[12px] font-medium text-[var(--accent-ink)]">{task.location}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">{task.description}</p>
                  <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={task.run}>{task.action}</Button>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 space-y-3 border-t border-[var(--border-subtle)] pt-4 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            <div><h3 className="font-semibold text-[var(--text-primary)]">Move around the graph</h3><p>Drag to orbit in 3D or pan in 2D. Scroll to zoom; on touch screens, pinch. The controls above the graph choose the view and Tool. Choose Probe to inspect coordinates.</p></div>
            <div><h3 className="font-semibold text-[var(--text-primary)]">Save, import, and export</h3><p>Use Scene on a wide screen or More actions on a small screen to create, save, open, or import a project. Choose Share & export for JSON, PNG, SVG, and share links. The Share button opens the same export options on a wide screen.</p></div>
          </div>
        </div>
        <DialogFooter className="shrink-0">
          <Link href="/documentations" target="_blank" rel="noopener noreferrer" className="mr-auto rounded-[var(--radius-sm)] px-2 py-2 text-[13px] text-[var(--accent-ink)] outline-none hover:bg-[var(--accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Full documentation ↗</Link>
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>Close guide</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
