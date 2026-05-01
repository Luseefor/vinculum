"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectSummary } from "@/lib/projects/localProjectRepository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

type ProjectDialogMode = "saveAs" | "open";

interface ProjectDialogProps {
  open: boolean;
  mode: ProjectDialogMode;
  defaultName: string;
  projects: ProjectSummary[];
  error: string | null;
  onClose: () => void;
  onSaveAs: (name: string) => void;
  onOpen: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}

export default function ProjectDialog({
  open,
  mode,
  defaultName,
  projects,
  error,
  onClose,
  onSaveAs,
  onOpen,
  onDelete
}: ProjectDialogProps) {
  const [nameInput, setNameInput] = useState(defaultName);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setNameInput(defaultName);
    setConfirmDeleteId(null);
  }, [defaultName, open, mode]);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [projects]
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "saveAs" ? "Save as project" : "Open project"}
          </DialogTitle>
          <DialogDescription>
            {mode === "saveAs"
              ? "Save the current scene as a named local project."
              : "Open, review, or delete local projects."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {mode === "saveAs" ? (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]" htmlFor="project-name-input">
                Project name
              </label>
              <Input
                id="project-name-input"
                data-autofocus={mode === "saveAs" ? "true" : undefined}
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                className="h-9"
                placeholder="Untitled Project"
              />
            </div>
          ) : null}

          <ScrollArea className="max-h-80 rounded-lg border border-[var(--border-subtle)]">
            {sortedProjects.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-[var(--text-tertiary)]">No saved projects yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {sortedProjects.map((project) => (
                  <li key={project.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onOpen(project.id)}
                        className="min-w-0 text-left"
                      >
                        <p className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{project.name}</p>
                        <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">
                          Updated {new Date(project.updatedAt).toLocaleString()} · {project.objectCount} objects · schema v{project.sceneSchemaVersion}
                        </p>
                      </button>
                      {confirmDeleteId === project.id ? (
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </Button>
                          <Button type="button" size="sm" variant="primary" onClick={() => onDelete(project.id)}>
                            Confirm
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setConfirmDeleteId(project.id)}
                          aria-label={`Delete ${project.name}`}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>

          {error ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            data-autofocus={mode !== "saveAs" ? "true" : undefined}
            onClick={onClose}
            size="sm"
            variant="secondary"
          >
            Close
          </Button>
          {mode === "saveAs" ? (
            <Button type="button" size="sm" variant="primary" onClick={() => onSaveAs(nameInput)}>
              Save project
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
