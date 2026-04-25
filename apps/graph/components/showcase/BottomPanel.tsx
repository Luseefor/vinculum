"use client";

import { useMemo, useState } from "react";
import { useEditorStore } from "@/lib/store/editorStore";
import { IconExpand, IconMore, IconPlay, IconStepBack, IconStepForward } from "@/components/showcase/icons";
import { Button, DividerHandle, IconButton, Slider, Tabs } from "@/components/showcase/ui";

interface BottomPanelProps {
  collapsed: boolean;
  height: number;
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  onHandleDoubleClick: () => void;
}

export default function BottomPanel({ collapsed, height, onResizeStart, onHandleDoubleClick }: BottomPanelProps) {
  const activeTab = useEditorStore((state) => state.bottomPanelTab);
  const setActiveTab = useEditorStore((state) => state.setBottomPanelTab);
  const parameters = useEditorStore((state) => state.parameters);
  const setParameterValue = useEditorStore((state) => state.setParameterValue);
  const animation = useEditorStore((state) => state.animation);
  const setAnimationPlaying = useEditorStore((state) => state.setAnimationPlaying);
  const setAnimationSpeed = useEditorStore((state) => state.setAnimationSpeed);
  const [timelineSeconds] = useState(0);

  const tabValue = useMemo(() => {
    if (activeTab === "parameters" || activeTab === "timeline" || activeTab === "console" || activeTab === "diagnostics") {
      return activeTab;
    }
    return "parameters";
  }, [activeTab]);

  return (
    <section className="bottom-panel-wrap" style={{ height: collapsed ? 42 : Math.max(120, Math.min(250, height)) }}>
      <div className="bottom-handle-zone" onPointerDown={onResizeStart} onDoubleClick={onHandleDoubleClick}>
        <DividerHandle className="bottom-divider-handle" />
      </div>

      <div className="bottom-panel">
        <div className="bottom-panel-head">
          <Tabs
            tabs={[
              { id: "parameters", label: "PARAMETERS" },
              { id: "timeline", label: "TIMELINE" },
              { id: "console", label: "CONSOLE" },
              { id: "diagnostics", label: "DIAGNOSTICS" }
            ]}
            activeTab={tabValue}
            onChange={(id) => setActiveTab(id as "parameters" | "timeline" | "console" | "diagnostics")}
          />
          <div className="bottom-head-actions">
            <span>Speed</span>
            <Button className="v-btn-sm bottom-speed">{animation.speed.toFixed(1)}x</Button>
            <IconButton icon={<span className="icon-14"><IconExpand /></span>} className="v-btn-sm" ariaLabel="Expand" />
          </div>
        </div>

        {!collapsed ? (
          <div className="bottom-content">
            <div className="bottom-parameters">
              {parameters.slice(0, 2).map((parameter) => (
                <div key={parameter.id} className="param-row">
                  <span className="param-chip">{parameter.id}</span>
                  <Slider
                    value={parameter.value}
                    min={parameter.min}
                    max={parameter.max}
                    step={0.1}
                    onChange={(value) => setParameterValue(parameter.id, value)}
                  />
                  <input
                    className="param-value"
                    value={parameter.value.toFixed(2)}
                    onChange={(event) => setParameterValue(parameter.id, Number(event.target.value))}
                  />
                  <Button className="v-btn-sm param-icon">∿</Button>
                  <Button className="v-btn-sm param-icon">⛓</Button>
                  <IconButton icon={<span className="icon-14"><IconMore /></span>} className="v-btn-sm param-icon" ariaLabel="More" />
                </div>
              ))}
            </div>

            <div className="bottom-timeline">
              <div className="timeline-controls">
                <IconButton
                  icon={<span className="icon-14"><IconPlay /></span>}
                  className="timeline-play"
                  ariaLabel="Play"
                  onClick={() => setAnimationPlaying(!animation.playing)}
                />
                <IconButton icon={<span className="icon-14"><IconStepBack /></span>} className="v-btn-sm" ariaLabel="Back" />
                <IconButton icon={<span className="icon-14"><IconStepForward /></span>} className="v-btn-sm" ariaLabel="Forward" />
                <span className="timeline-code">{formatTime(timelineSeconds)}</span>
              </div>
              <div className="timeline-ruler">
                <div className="timeline-ticks">
                  <span>00:00</span>
                  <span>01:00</span>
                  <span>02:00</span>
                  <span>03:00</span>
                  <span>04:00</span>
                  <span>05:00</span>
                </div>
                <div className="timeline-track">
                  <span className="timeline-progress" />
                  <span className="timeline-marker" />
                </div>
              </div>
              <div className="timeline-speed-row">
                <span>Speed</span>
                <Slider value={animation.speed} min={0.1} max={4} step={0.1} onChange={setAnimationSpeed} />
                <span>{animation.speed.toFixed(1)}x</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  const hundredths = Math.floor((safe % 1) * 100)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}.${hundredths}`;
}
