"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditorStore } from "@/lib/store/editorStore";

export default function AnimationTab() {
  const parameters = useEditorStore((state) => state.parameters);
  const setParameterValue = useEditorStore((state) => state.setParameterValue);
  const animation = useEditorStore((state) => state.animation);
  const setAnimationParameterId = useEditorStore((state) => state.setAnimationParameterId);
  const setAnimationRange = useEditorStore((state) => state.setAnimationRange);
  const setAnimationSpeed = useEditorStore((state) => state.setAnimationSpeed);
  const toggleAnimationLoop = useEditorStore((state) => state.toggleAnimationLoop);
  const setAnimationPlaying = useEditorStore((state) => state.setAnimationPlaying);
  const directionRef = useRef<1 | -1>(1);

  useEffect(() => {
    if (!animation.playing || !animation.parameterId) {
      return;
    }
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const parameter = parameters.find((item) => item.id === animation.parameterId);
      if (parameter) {
        const next = parameter.value + directionRef.current * animation.speed * dt;
        if (next > animation.max) {
          if (animation.loop) {
            directionRef.current = -1;
            setParameterValue(parameter.id, animation.max);
          } else {
            setParameterValue(parameter.id, animation.max);
            setAnimationPlaying(false);
            return;
          }
        } else if (next < animation.min) {
          if (animation.loop) {
            directionRef.current = 1;
            setParameterValue(parameter.id, animation.min);
          } else {
            setParameterValue(parameter.id, animation.min);
            setAnimationPlaying(false);
            return;
          }
        } else {
          setParameterValue(parameter.id, next);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    animation.loop,
    animation.max,
    animation.min,
    animation.parameterId,
    animation.playing,
    animation.speed,
    parameters,
    setAnimationPlaying,
    setParameterValue
  ]);

  return (
    <section className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 p-3">
      <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">Animation</h3>
      <label className="block">
        <span className="mb-1 block text-[10px] text-[var(--text-secondary)]">Parameter</span>
        <select
          value={animation.parameterId ?? ""}
          onChange={(event) => setAnimationParameterId(event.target.value || null)}
          className="h-8 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 text-[11px]"
        >
          <option value="">None</option>
          {parameters.map((parameter) => (
            <option key={parameter.id} value={parameter.id}>
              {parameter.id}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] text-[var(--text-secondary)]">Min</span>
          <Input
            value={animation.min}
            onChange={(event) => setAnimationRange(Number(event.target.value), animation.max)}
            className="h-8 text-[11px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] text-[var(--text-secondary)]">Max</span>
          <Input
            value={animation.max}
            onChange={(event) => setAnimationRange(animation.min, Number(event.target.value))}
            className="h-8 text-[11px]"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-[10px] text-[var(--text-secondary)]">Speed</span>
        <Input value={animation.speed} onChange={(event) => setAnimationSpeed(Number(event.target.value))} className="h-8 text-[11px]" />
      </label>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => setAnimationPlaying(!animation.playing)}>
          {animation.playing ? "Pause" : "Play"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={toggleAnimationLoop}>
          Loop: {animation.loop ? "On" : "Off"}
        </Button>
      </div>
    </section>
  );
}
