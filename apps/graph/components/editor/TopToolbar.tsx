"use client";

import { useState, useRef, useEffect } from "react";
import { useHistoryStore } from "@/lib/store/historyStore";
import NewSceneDialog from "@/components/layout/NewSceneDialog";
import { useGraphStore } from "@/store/graphStore";
import { cn } from "@/components/ui/styles";
import { 
  VinculumMark, 
  UndoIcon, 
  RedoIcon, 
  ChevronDownIcon, 
  SunIcon, 
  MoonIcon 
} from "@/components/layout/icons";
import { Portal } from "@/components/ui/portal";
import type { AccentPreset } from "@/types/graphUi";

const accentOptions: AccentPreset[] = ["indigo", "blue", "cyan", "emerald", "green", "amber", "orange", "rose", "pink", "violet"];

export default function TopToolbar({ canUndo, canRedo, onUndo, onRedo }: any) {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [newSceneOpen, setNewSceneOpen] = useState(false);
  const fileTriggerRef = useRef<HTMLButtonElement>(null);
  const themeTriggerRef = useRef<HTMLButtonElement>(null);

  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const themeMode = useGraphStore((state) => state.ui.themeMode);
  const setThemeMode = useGraphStore((state) => state.setThemeMode);
  const accentPreset = useGraphStore((state) => state.ui.accentPreset);
  const setAccentPreset = useGraphStore((state) => state.setAccentPreset);
  const resetScene = useGraphStore((state) => state.resetScene);
  const openSceneDialog = useGraphStore((state) => state.openSceneDialog);
  const clearHistory = useHistoryStore((state) => state.clear);

  const handleNewSceneMenuClick = () => {
    if (objectCount === 0) {
      clearHistory();
      resetScene();
      setFileMenuOpen(false);
      return;
    }
    setNewSceneOpen(true);
    setFileMenuOpen(false);
  };

  const handleConfirmNewScene = () => {
    clearHistory();
    resetScene();
    setNewSceneOpen(false);
    setFileMenuOpen(false);
  };

  // Robust click-outside logic for Portals
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if click was inside a portal container
      const isInsidePortal = target.closest('[data-portal-content="true"]');
      if (isInsidePortal) return;

      // Close menus if clicking outside of their respective triggers
      if (fileMenuOpen && !fileTriggerRef.current?.contains(target)) {
        setFileMenuOpen(false);
      }
      if (themeMenuOpen && !themeTriggerRef.current?.contains(target)) {
        setThemeMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [fileMenuOpen, themeMenuOpen]);

  useEffect(() => {
    if (!themeMenuOpen && !fileMenuOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setThemeMenuOpen(false);
        setFileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [themeMenuOpen, fileMenuOpen]);

  return (
    <>
      <NewSceneDialog
        open={newSceneOpen}
        onConfirm={handleConfirmNewScene}
        onCancel={() => setNewSceneOpen(false)}
      />
      <header className="flex h-11 shrink-0 items-center border-b border-[var(--panel-border)] bg-[var(--bg-tertiary)] px-4 z-50 font-sans">
      <div className="flex items-center gap-2 mr-6">
        <VinculumMark className="h-5 w-5" />
        <span className="text-[11px] font-bold tracking-tight text-[var(--text-primary)] uppercase">Vinculum</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          ref={fileTriggerRef}
          type="button"
          onClick={() => setFileMenuOpen(!fileMenuOpen)}
          className={cn(
            "flex items-center gap-1.5 h-7 px-3 rounded-full text-[10px] font-bold uppercase transition-all",
            fileMenuOpen ? "bg-[var(--surface-muted)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          )}
        >
          Scene
          <ChevronDownIcon className={cn("h-3 w-3 transition-transform", fileMenuOpen && "rotate-180")} />
        </button>

        <div className="w-px h-4 bg-[var(--border-strong)] mx-2" />

        <div className="flex items-center gap-0.5">
          <ToolbarAction onClick={onUndo} disabled={!canUndo} icon={<UndoIcon className="h-3.5 w-3.5" />} title="Undo" />
          <ToolbarAction onClick={onRedo} disabled={!canRedo} icon={<RedoIcon className="h-3.5 w-3.5" />} title="Redo" />
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-1 shadow-sm">
          <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Objects</span>
          <span className="text-[9px] font-bold text-[var(--accent)]">{objectCount}</span>
        </div>

        <button
          ref={themeTriggerRef}
          type="button"
          aria-label="Open theme and accent menu"
          aria-expanded={themeMenuOpen}
          onClick={() => setThemeMenuOpen(!themeMenuOpen)}
          className={cn(
            "flex items-center justify-center h-7 w-7 rounded-full transition-all",
            themeMenuOpen ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          )}
        >
          {themeMode === "dark" ? <MoonIcon className="h-3.5 w-3.5" /> : <SunIcon className="h-3.5 w-3.5" />}
        </button>
      </div>

      {fileMenuOpen && (
        <Portal>
          <div 
            data-portal-content="true"
            className="fixed z-[100] w-44 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-overlay)] shadow-2xl backdrop-blur-xl animate-slide-up"
            style={{
              top: (fileTriggerRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
              left: (fileTriggerRef.current?.getBoundingClientRect().left ?? 0)
            }}
          >
            <div className="p-1 flex flex-col gap-0.5">
              <MenuButton onClick={handleNewSceneMenuClick}>New Scene</MenuButton>
              <MenuButton onClick={() => { openSceneDialog("import"); setFileMenuOpen(false); }}>Import...</MenuButton>
              <MenuButton onClick={() => { openSceneDialog("export"); setFileMenuOpen(false); }}>Export...</MenuButton>
            </div>
          </div>
        </Portal>
      )}

      {themeMenuOpen && (
        <Portal>
          <div 
            data-portal-content="true"
            className="fixed z-[100] w-64 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-overlay)] shadow-2xl backdrop-blur-xl animate-slide-up p-4 flex flex-col gap-6"
            style={{
              top: (themeTriggerRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
              right: window.innerWidth - (themeTriggerRef.current?.getBoundingClientRect().right ?? 0)
            }}
          >
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Appearance</h3>
              <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--bg-primary)] border border-[var(--border-strong)]">
                <button
                  type="button"
                  aria-label="Use light theme"
                  onClick={() => setThemeMode("light")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 h-7 rounded-full text-[10px] font-bold transition",
                    themeMode === "light" ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <SunIcon className="h-3.5 w-3.5" /> LIGHT
                </button>
                <button
                  type="button"
                  aria-label="Use dark theme"
                  onClick={() => setThemeMode("dark")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 h-7 rounded-full text-[10px] font-bold transition",
                    themeMode === "dark" ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <MoonIcon className="h-3.5 w-3.5" /> DARK
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Accent Color</h3>
              <div className="grid grid-cols-5 gap-3 justify-items-center">
                {accentOptions.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAccentPreset(preset)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-all hover:scale-125 active:scale-90",
                      accentPreset === preset ? "border-[var(--text-primary)] ring-2 ring-[var(--accent-primary)]/20 shadow-md" : "border-transparent opacity-80 hover:opacity-100"
                    )}
                    style={{ backgroundColor: `var(--clr-${preset})` }}
                    aria-label={`Accent ${preset}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </header>
    </>
  );
}

function ToolbarAction({ onClick, disabled, icon, title }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center h-7 w-7 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
    >
      {icon}
    </button>
  );
}

function MenuButton({ children, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center px-3 py-1.5 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-soft)] rounded-md transition-all uppercase tracking-tight"
    >
      {children}
    </button>
  );
}
