"use client";

import { Children, useSyncExternalStore, type ReactNode } from "react";
import { LazyMotion, domAnimation, m, type Variants } from "motion/react";

// Motion Primitives Animated Group, adapted to Vinculum's short motion timing,
// lazy animation features, and an immediate reduced-motion presentation.
// Source: https://motion-primitives.com/docs/animated-group
const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.12, staggerChildren: 0.025 } }
};
const item: Variants = {
  hidden: { opacity: 0, y: 5 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] } }
};
const immediate: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0 } }
};
const motionPreference = "(prefers-reduced-motion: reduce)";
function subscribeMotionPreference(onChange: () => void) {
  const query = window.matchMedia(motionPreference);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const readMotionPreference = () => window.matchMedia(motionPreference).matches;
// Render readable content on the server, before a motion preference is known.
const serverMotionPreference = () => true;

export function AnimatedGroup({ children, className }: { children: ReactNode; className?: string }) {
  const reducedMotion = useSyncExternalStore(subscribeMotionPreference, readMotionPreference, serverMotionPreference);
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div className={className} initial={reducedMotion ? false : "hidden"} animate="visible" variants={reducedMotion ? immediate : container} style={reducedMotion ? { opacity: 1 } : undefined}>
        {Children.map(children, child => child ? (
          <m.div variants={reducedMotion ? immediate : item} style={reducedMotion ? { opacity: 1, transform: "none" } : undefined}>{child}</m.div>
        ) : null)}
      </m.div>
    </LazyMotion>
  );
}
