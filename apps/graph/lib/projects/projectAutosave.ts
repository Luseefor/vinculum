import type { SceneDocument } from "@/lib/scene/sceneSchema";
import type { LocalProjectRepository } from "./localProjectRepository";

export interface ProjectAutosaveStatusCallbacks {
  onDirty: () => void;
  onSaving: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}

interface ProjectAutosaveInput {
  projectId: string;
  projectName: string;
  scene: SceneDocument;
}

export class ProjectAutosaveController {
  private timerId: number | null = null;

  constructor(
    private readonly repository: LocalProjectRepository,
    private readonly callbacks: ProjectAutosaveStatusCallbacks,
    private readonly debounceMs = 900
  ) {}

  scheduleProjectAutosave(input: ProjectAutosaveInput): void {
    this.clearPending();
    this.callbacks.onDirty();
    this.timerId = window.setTimeout(() => {
      this.callbacks.onSaving();
      try {
        this.repository.saveProject({
          projectId: input.projectId,
          name: input.projectName,
          scene: input.scene
        });
        this.callbacks.onSaved();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Autosave failed.";
        this.callbacks.onError(message);
      }
    }, this.debounceMs);
  }

  scheduleUnnamedRecovery(scene: SceneDocument): void {
    this.clearPending();
    this.timerId = window.setTimeout(() => {
      try {
        this.repository.saveUnnamedRecoverySnapshot(scene);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Recovery snapshot save failed.";
        this.callbacks.onError(message);
      }
    }, this.debounceMs);
  }

  clearPending(): void {
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
