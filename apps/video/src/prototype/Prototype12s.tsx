import React from "react";
import { useCurrentFrame } from "remotion";
import { PROTOTYPE_TIMELINE } from "./prototypeTimeline";
import { Shot1Hook } from "./Shot1Hook";
import { Shot2Brand } from "./Shot2Brand";
import { Shot3Editor } from "./Shot3Editor";
import { Shot4Parametric } from "./Shot4Parametric";
import { Shot5Surfaces } from "./Shot5Surfaces";

/**
 * Prototype12s (extended to Prototype16s with Shot 5 Surfaces)
 * The clean, restrained product prototype showcasing:
 * - Shot 1: The Hook ("Mathematics shouldn't feel flat.")
 * - Shot 2: Brand punctuation ("VINCULUM / See the beauty in every equation.")
 * - Shot 3: Product Reveal (Large real Vinculum workspace ~82% width, directed viewport zoom)
 * - Shot 4: Full-Canvas Parametric Curve (Live curve drawing with moving parameter t and tangent vector T(t))
 * - Shot 5: Differential Surfaces (Parametric hyperbolic paraboloid saddle with Gaussian curvature kappa)
 *
 * Visual Rules Applied:
 * - Pure near-black background (#050811)
 * - Zero decorative star wallpaper
 * - Zero floating glassmorphism cards wrapping concepts
 * - One clear focal point per shot
 * - Confident editorial cuts
 */
export const Prototype12s: React.FC = () => {
  const frame = useCurrentFrame();
  const { shots } = PROTOTYPE_TIMELINE;

  return (
    <div className="relative w-full h-full bg-[#050811] text-white overflow-hidden select-none font-sans">
      {/* Very subtle ambient cyan glow at the center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(6, 182, 212, 0.04) 0%, transparent 70%)",
        }}
      />

      {/* Shot 1: Hook (0 - 75 frames) */}
      {frame >= shots.hook.start && frame < shots.hook.end && (
        <Shot1Hook frame={frame - shots.hook.start} />
      )}

      {/* Shot 2: Brand (75 - 126 frames) */}
      {frame >= shots.brand.start && frame < shots.brand.end && (
        <Shot2Brand frame={frame - shots.brand.start} />
      )}

      {/* Shot 3: Editor Reveal (126 - 225 frames) */}
      {frame >= shots.editor.start && frame < shots.editor.end && (
        <Shot3Editor frame={frame - shots.editor.start} />
      )}

      {/* Shot 4: Parametric Geometry (225 - 360 frames) */}
      {frame >= shots.parametric.start && frame < shots.parametric.end && (
        <Shot4Parametric frame={frame - shots.parametric.start} />
      )}

      {/* Shot 5: Differential Surfaces (360 - 495 frames) */}
      {frame >= shots.surfaces.start && frame < shots.surfaces.end && (
        <Shot5Surfaces frame={frame - shots.surfaces.start} />
      )}
    </div>
  );
};
