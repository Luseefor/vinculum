"use client";

import AnnotationLabel from "@/components/showcase/AnnotationLabel";
import AppFrame from "@/components/showcase/AppFrame";
import DetailsGrid from "@/components/showcase/DetailsGrid";
import { useGraphStore } from "@/store/graphStore";

export default function DesignBoardPage() {
  const themeMode = useGraphStore((state) => state.ui.themeMode);
  const accentPreset = useGraphStore((state) => state.ui.accentPreset);
  const density = useGraphStore((state) => state.ui.density);
  const setThemeMode = useGraphStore((state) => state.setThemeMode);
  const setAccentPreset = useGraphStore((state) => state.setAccentPreset);
  const setDensity = useGraphStore((state) => state.setDensity);

  return (
    <main className="design-board">
      <section className="annotation-layer" aria-hidden="true">
        <AnnotationLabel title="Top Command Bar" description="All primary controls, tools, and actions." side="left" top="6%" />
        <AnnotationLabel title="Left Rail" description="Quick access to main tools and modes." side="left" top="19%" />
        <AnnotationLabel title="Left Panel (Collapsible)" description="Scene objects, quick add, layers." side="left" top="34%" />
        <AnnotationLabel
          title="Resizable Bottom Panel"
          description={"Drag the top edge to adjust height.\nDouble click to collapse / expand."}
          side="left"
          top="58%"
        />

        <AnnotationLabel title="Right Panel (Collapsible)" description="Inspector, properties, styles, links." side="right" top="18%" />
        <AnnotationLabel
          title="Workspace"
          description={"2D / 3D / Quad / Single\nSplit panels are resizable by dragging the divider."}
          side="right"
          top="32%"
        />
        <AnnotationLabel title="Status Bar" description="Live feedback, snapping, hotkeys, connection." side="right" top="62%" />
      </section>

      <section className="app-showcase">
        <AppFrame />
      </section>

      <DetailsGrid
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        accentPreset={accentPreset}
        onAccentPresetChange={setAccentPreset}
        density={density}
        onDensityChange={setDensity}
      />
    </main>
  );
}
