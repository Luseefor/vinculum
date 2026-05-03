"use client";

import { MoonIcon, SunIcon } from "@/components/layout/icons";
import { cn } from "@/components/ui/styles";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";
import type { AccentPreset } from "@/types/graphUi";
import { captureEvent } from "@/lib/analytics/posthog";

const accentOptions: AccentPreset[] = ["indigo", "blue", "cyan", "emerald", "green", "amber", "orange", "rose", "pink", "violet"];

interface ThemeAccentPopoverProps {
  showPerformance?: boolean;
  context?: "landing" | "editor";
}

export default function ThemeAccentPopover({
  showPerformance = true,
  context = "landing"
}: ThemeAccentPopoverProps) {
  const themeMode = useGraphStore((state) => state.ui.themeMode);
  const setThemeMode = useGraphStore((state) => state.setThemeMode);
  const accentPreset = useGraphStore((state) => state.ui.accentPreset);
  const setAccentPreset = useGraphStore((state) => state.setAccentPreset);
  const showPerfHud = useEditorStore((state) => state.showPerfHud);
  const setShowPerfHud = useEditorStore((state) => state.setShowPerfHud);

  return (
    <div id="vinculum-theme-menu" className="w-72 p-3.5 flex flex-col gap-3">
        <section className="space-y-2 rounded-[6px] border border-[var(--border-subtle)] px-3 py-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Appearance</h3>
              <Badge variant="outline">Theme</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
              type="button"
              aria-label="Use light theme"
              onClick={() => {
                setThemeMode("light");
                captureEvent(context === "editor" ? "editor_theme_changed" : "landing_theme_changed", { theme: "light" });
              }}
              className={cn(
                "h-8 gap-2 text-[10px] font-bold uppercase tracking-wide",
                themeMode === "light"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)]"
              )}
              variant="secondary"
              size="sm"
            >
              <SunIcon className="h-3.5 w-3.5" /> LIGHT
              </Button>
              <Button
              type="button"
              aria-label="Use dark theme"
              onClick={() => {
                setThemeMode("dark");
                captureEvent(context === "editor" ? "editor_theme_changed" : "landing_theme_changed", { theme: "dark" });
              }}
              className={cn(
                "h-8 gap-2 text-[10px] font-bold uppercase tracking-wide",
                themeMode === "dark"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)]"
              )}
              variant="secondary"
              size="sm"
            >
              <MoonIcon className="h-3.5 w-3.5" /> DARK
              </Button>
            </div>
        </section>

        <Separator />

        <section className="space-y-3 rounded-[6px] border border-[var(--border-subtle)] px-3 py-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Accent Color</h3>
              <Badge variant="outline">{accentPreset}</Badge>
            </div>
            <div className="grid grid-cols-5 gap-2.5 justify-items-center">
            {accentOptions.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setAccentPreset(preset);
                  captureEvent(context === "editor" ? "editor_accent_changed" : "landing_accent_changed", { accent: preset });
                }}
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition-all hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                  accentPreset === preset ? "border-[var(--text-primary)] ring-2 ring-[var(--accent-primary)]/20 shadow-md opacity-100" : "border-transparent opacity-80 hover:opacity-100"
                )}
                style={{ backgroundColor: `var(--clr-${preset})` }}
                aria-label={`Accent ${preset}`}
              />
            ))}
            </div>
        </section>

        {showPerformance ? (
          <>
            <Separator />
            <section className="space-y-2 rounded-[6px] border border-[var(--border-subtle)] px-3 py-2.5">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Performance</h3>
                <button
              type="button"
              role="checkbox"
              aria-checked={showPerfHud}
              onClick={() => setShowPerfHud(!showPerfHud)}
              className={cn(
                "flex items-center justify-between gap-3 w-full h-8 px-3 rounded-md border text-[10px] font-bold transition",
                showPerfHud
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              )}
            >
              <span>Performance HUD</span>
              <span className="font-mono">{showPerfHud ? "ON" : "OFF"}</span>
                </button>
            </section>
          </>
        ) : null}
    </div>
  );
}
