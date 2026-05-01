"use client";

import { useEffect, useState } from "react";
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
  const [minDraft, setMinDraft] = useState(() => String(animation.min));
  const [maxDraft, setMaxDraft] = useState(() => String(animation.max));
  const [speedDraft, setSpeedDraft] = useState(() => String(animation.speed));

  useEffect(() => {
    setMinDraft(String(animation.min));
  }, [animation.min]);

  useEffect(() => {
    setMaxDraft(String(animation.max));
  }, [animation.max]);

  useEffect(() => {
    setSpeedDraft(String(animation.speed));
  }, [animation.speed]);

  useEffect(() => {
    if (!animation.playing || !animation.parameterId) {
      return;
    }
    let raf = 0;
    let last = performance.now();
    const parameterId = animation.parameterId;
    const parameter = useEditorStore.getState().parameters.find((item) => item.id === parameterId);
    if (!parameter) {
      return;
    }

    let value = Math.min(animation.max, Math.max(animation.min, parameter.value));
    const span = animation.max - animation.min;
    let direction: 1 | -1 = 1;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      value += direction * animation.speed * dt;

      if (animation.loop) {
        if (span <= 0) {
          value = animation.min;
        } else {
          while (value > animation.max || value < animation.min) {
            if (value > animation.max) {
              value = animation.max - (value - animation.max);
              direction = -1;
            } else if (value < animation.min) {
              value = animation.min + (animation.min - value);
              direction = 1;
            }
          }
        }
      } else if (value >= animation.max) {
        value = animation.max;
        setParameterValue(parameterId, value);
        setAnimationPlaying(false);
        return;
      }

      setParameterValue(parameterId, value);
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
    <section className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-3">
      <header>
        <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Animation</h3>
      </header>
      <div className="space-y-2 pt-3">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Parameter</span>
          <select
            value={animation.parameterId ?? ""}
            onChange={(event) => setAnimationParameterId(event.target.value || null)}
            className="h-8 w-full rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
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
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Min</span>
            <Input
              type="text"
              inputMode="decimal"
              value={minDraft}
              onChange={(event) => {
                const next = event.target.value;
                setMinDraft(next);
                const parsed = Number(next);
                if (Number.isFinite(parsed)) {
                  setAnimationRange(parsed, animation.max);
                }
              }}
              onBlur={() => {
                const parsed = Number(minDraft);
                if (Number.isFinite(parsed)) {
                  setAnimationRange(parsed, animation.max);
                } else {
                  setMinDraft(String(animation.min));
                }
              }}
              className="h-8 rounded-[6px] text-[13px]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Max</span>
            <Input
              type="text"
              inputMode="decimal"
              value={maxDraft}
              onChange={(event) => {
                const next = event.target.value;
                setMaxDraft(next);
                const parsed = Number(next);
                if (Number.isFinite(parsed)) {
                  setAnimationRange(animation.min, parsed);
                }
              }}
              onBlur={() => {
                const parsed = Number(maxDraft);
                if (Number.isFinite(parsed)) {
                  setAnimationRange(animation.min, parsed);
                } else {
                  setMaxDraft(String(animation.max));
                }
              }}
              className="h-8 rounded-[6px] text-[13px]"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Speed</span>
          <Input
            type="text"
            inputMode="decimal"
            value={speedDraft}
            onChange={(event) => {
              const next = event.target.value;
              setSpeedDraft(next);
              const parsed = Number(next);
              if (Number.isFinite(parsed)) {
                setAnimationSpeed(parsed);
              }
            }}
            onBlur={() => {
              const parsed = Number(speedDraft);
              if (Number.isFinite(parsed)) {
                setAnimationSpeed(parsed);
              } else {
                setSpeedDraft(String(animation.speed));
              }
            }}
            className="h-8 rounded-[6px] text-[13px]"
          />
        </label>
        <div className="flex items-center gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={() => setAnimationPlaying(!animation.playing)}>
            {animation.playing ? "Pause" : "Play"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={toggleAnimationLoop}>
            Loop: {animation.loop ? "On" : "Off"}
          </Button>
        </div>
      </div>
    </section>
  );
}
