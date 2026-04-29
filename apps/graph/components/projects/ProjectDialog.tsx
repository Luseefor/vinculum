"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectSummary } from "@/lib/projects/localProjectRepository";
import { useDialogFocusTrap } from "@/lib/a11y/useDialogFocusTrap";

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
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap({ open, containerRef: dialogRef });

  const [nameInput, setNameInput] = useState(defaultName);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setNameInput(defaultName);
    setConfirmDeleteId(null);
  }, [defaultName, open, mode]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [projects]
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-[var(--surface-backdrop)] p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="panel w-full max-w-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 id="project-dialog-title" className="text-sm font-semibold text-[var(--text-primary)]">
            {mode === "saveAs" ? "Save as project" : "Open project"}
          </h2>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            {mode === "saveAs"
              ? "Save the current scene as a named local project."
              : "Open, review, or delete local projects."}
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          {mode === "saveAs" ? (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]" htmlFor="project-name-input">
                Project name
              </label>
              <input
                id="project-name-input"
                data-autofocus={mode === "saveAs" ? "true" : undefined}
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                className="input h-9"
                placeholder="Untitled Project"
              />
            </div>
          ) : null}

          <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--border-subtle)]">
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
                          <button type="button" className="btn" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </button>
                          <button type="button" className="btn btn-primary" onClick={() => onDelete(project.id)}>
                            Confirm
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setConfirmDeleteId(project.id)}
                          aria-label={`Delete ${project.name}`}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <button
            type="button"
            data-autofocus={mode !== "saveAs" ? "true" : undefined}
            onClick={onClose}
            className="btn"
          >
            Close
          </button>
          {mode === "saveAs" ? (
            <button type="button" onClick={() => onSaveAs(nameInput)} className="btn btn-primary">
              Save project
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
