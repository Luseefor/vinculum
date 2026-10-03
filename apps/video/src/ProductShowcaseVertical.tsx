import React from "react";
import { Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Intro } from "./scenes/Scene2Intro";
import { Scene3UnifiedCanvas } from "./scenes/Scene3UnifiedCanvas";
import { Scene4Surfaces } from "./scenes/Scene4Surfaces";
import { Scene5EnginePower } from "./scenes/Scene5EnginePower";
import { Scene6WorkflowExport } from "./scenes/Scene6WorkflowExport";
import { Scene7Outro } from "./scenes/Scene7Outro";
import { Soundtrack } from "./components/Soundtrack";

export const ProductShowcaseVertical: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = (frame / durationInFrames) * 100;

  let currentChapter = "The Genesis";
  if (frame >= 200 && frame < 420) currentChapter = "Introducing Vinculum";
  else if (frame >= 420 && frame < 650) currentChapter = "Unified 2D & 3D Space";
  else if (frame >= 650 && frame < 880) currentChapter = "Complex Surfaces";
  else if (frame >= 880 && frame < 1100) currentChapter = "Rust WASM Engine";
  else if (frame >= 1100 && frame < 1300) currentChapter = "Workflow & Export";
  else if (frame >= 1300) currentChapter = "Experience Vinculum";

  return (
    <div className="relative w-full h-full bg-[#050811] text-white overflow-hidden select-none font-sans scale-100 flex flex-col justify-center">
      {/* Cinematic Soundtrack & Spatial SFX */}
      <Soundtrack filename="audio/soundtrack.mp3" volume={0.85} />

      {/* Scene Sequences */}
      <Sequence from={0} durationInFrames={210} name="Scene 1: Hook">
        <Scene1Hook isVertical={true} />
      </Sequence>

      <Sequence from={200} durationInFrames={230} name="Scene 2: Intro">
        <Scene2Intro isVertical={true} />
      </Sequence>

      <Sequence from={420} durationInFrames={240} name="Scene 3: Unified Canvas">
        <Scene3UnifiedCanvas isVertical={true} />
      </Sequence>

      <Sequence from={650} durationInFrames={240} name="Scene 4: Surfaces">
        <Scene4Surfaces isVertical={true} />
      </Sequence>

      <Sequence from={880} durationInFrames={230} name="Scene 5: Engine Power">
        <Scene5EnginePower isVertical={true} />
      </Sequence>

      <Sequence from={1100} durationInFrames={210} name="Scene 6: Workflow & Export">
        <Scene6WorkflowExport isVertical={true} />
      </Sequence>

      <Sequence from={1300} durationInFrames={200} name="Scene 7: Outro">
        <Scene7Outro isVertical={true} />
      </Sequence>

      {/* Top Mobile HUD */}
      <div className="absolute top-12 left-8 right-8 flex items-center justify-between pointer-events-none z-50 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-white font-bold tracking-wider">VINCULUM</span>
        </div>
        <span className="text-cyan-300 font-semibold">{currentChapter}</span>
      </div>

      {/* Bottom Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 z-50 pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 shadow-[0_0_12px_rgba(6,182,212,0.8)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
