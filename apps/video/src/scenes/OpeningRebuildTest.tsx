import React from "react";
import { useCurrentFrame } from "remotion";
import { WorldCanvas } from "../motion/WorldCanvas";
import { getShowcaseCamera } from "../motion/camera";
import { OpeningSequence } from "../scenes/OpeningSequence";
import { ParticleBackground } from "../components/ParticleBackground";

export const OpeningRebuildTest: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = getShowcaseCamera(frame);

  return (
    <WorldCanvas camera={camera} isVertical={false}>
      {/* Persistent Coordinate Universe */}
      <ParticleBackground intensity={0.9} gridOpacity={0.25} />

      {/* Opening Sequence (0 - 255 frames) */}
      <OpeningSequence frame={frame} isVertical={false} />
    </WorldCanvas>
  );
};
