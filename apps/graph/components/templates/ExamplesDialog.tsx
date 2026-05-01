"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { SceneExampleDefinition } from "@/lib/templates/examplesRegistry";

interface ExamplesDialogProps {
  open: boolean;
  examples: SceneExampleDefinition[];
  error: string | null;
  onClose: () => void;
  onOpenExample: (exampleId: string) => void;
}

export default function ExamplesDialog({
  open,
  examples,
  error,
  onClose,
  onOpenExample
}: ExamplesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Examples</DialogTitle>
          <DialogDescription>Open example scenes for surfaces, planes, and parametric curves.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[460px] px-5 py-4">
          {examples.length === 0 ? (
            <p className="text-[12px] text-[var(--text-tertiary)]">No examples are available.</p>
          ) : (
            <ul className="space-y-1.5">
              {examples.map((example) => (
                <li key={example.id} className="rounded-[6px] border border-[var(--border-subtle)] px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{example.title}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge variant="secondary">{example.category}</Badge>
                        <Badge variant="outline">{example.recommendedMode.toUpperCase()}</Badge>
                      </div>
                    </div>
                    <Button type="button" variant="primary" size="sm" className="shrink-0" onClick={() => onOpenExample(example.id)}>
                      Open example
                    </Button>
                  </div>
                  <Separator className="my-2" />
                  <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{example.description}</p>
                </li>
              ))}
            </ul>
          )}
          {error ? (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              {error}
            </div>
          ) : null}
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="secondary" size="sm" data-autofocus="true" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
