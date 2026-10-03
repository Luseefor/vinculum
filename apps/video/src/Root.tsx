import React from "react";
import { Composition } from "remotion";
import { ProductShowcase } from "./ProductShowcase";
import { ProductShowcaseVertical } from "./ProductShowcaseVertical";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Intro } from "./scenes/Scene2Intro";
import { Scene3UnifiedCanvas } from "./scenes/Scene3UnifiedCanvas";
import { Scene4Surfaces } from "./scenes/Scene4Surfaces";
import { Scene5EnginePower } from "./scenes/Scene5EnginePower";
import { Scene6WorkflowExport } from "./scenes/Scene6WorkflowExport";
import { Scene7Outro } from "./scenes/Scene7Outro";
import { Prototype12s } from "./prototype/Prototype12s";
import { PROTOTYPE_TIMELINE } from "./prototype/prototypeTimeline";
import { VIDEO_FPS, TOTAL_DURATION_FRAMES, SCENE_DURATIONS } from "./types";
import { VinculumShowcaseMaster, MASTER_DURATION_FRAMES } from "./master/VinculumShowcaseMaster";
import "./style.css";

export const Root: React.FC = () => {
  return (
    <>
      {/* 34.00-Second Unified Master Showcase Film (Where Notation Becomes Space) */}
      <Composition
        id="VinculumShowcaseMaster"
        component={VinculumShowcaseMaster}
        durationInFrames={MASTER_DURATION_FRAMES}
        fps={VIDEO_FPS}
        width={1920}
        height={1080}
      />

      {/* 11.5-Second Tightened Prototype with Real Product Rendering */}
      <Composition
        id="Prototype12s"
        component={Prototype12s}
        durationInFrames={PROTOTYPE_TIMELINE.durationInFrames}
        fps={VIDEO_FPS}
        width={1920}
        height={1080}
      />

      {/* Master 16:9 Landscape Product Video (50s / 1500 frames) */}
      <Composition
        id="ProductShowcase"
        component={ProductShowcase}
        durationInFrames={TOTAL_DURATION_FRAMES}
        fps={VIDEO_FPS}
        width={1920}
        height={1080}
      />

      {/* Master 9:16 Vertical Mobile Video (50s / 1500 frames) */}
      <Composition
        id="ProductShowcaseVertical"
        component={ProductShowcaseVertical}
        durationInFrames={TOTAL_DURATION_FRAMES}
        fps={VIDEO_FPS}
        width={1080}
        height={1920}
      />

      {/* Individual Scene Previews for Fine-Tuning */}
      <Composition
        id="Scene1Hook"
        component={Scene1Hook}
        durationInFrames={SCENE_DURATIONS.scene1Hook}
        fps={VIDEO_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Scene2Intro"
        component={Scene2Intro}
        durationInFrames={SCENE_DURATIONS.scene2Intro}
        fps={VIDEO_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Scene3UnifiedCanvas"
        component={Scene3UnifiedCanvas}
        durationInFrames={SCENE_DURATIONS.scene3UnifiedCanvas}
        fps={VIDEO_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Scene4Surfaces"
        component={Scene4Surfaces}
        durationInFrames={SCENE_DURATIONS.scene4Surfaces}
        fps={VIDEO_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Scene5EnginePower"
        component={Scene5EnginePower}
        durationInFrames={SCENE_DURATIONS.scene5EnginePower}
        fps={VIDEO_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Scene6WorkflowExport"
        component={Scene6WorkflowExport}
        durationInFrames={SCENE_DURATIONS.scene6WorkflowExport}
        fps={VIDEO_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Scene7Outro"
        component={Scene7Outro}
        durationInFrames={SCENE_DURATIONS.scene7Outro}
        fps={VIDEO_FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
