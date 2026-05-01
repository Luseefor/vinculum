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

  const tabValue = useMemo(() => {
    if (activeTab === "parameters" || activeTab === "console" || activeTab === "diagnostics") {
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
              { id: "console", label: "CONSOLE" },
              { id: "diagnostics", label: "DIAGNOSTICS" }
            ]}
            activeTab={tabValue}
            onChange={(id) => setActiveTab(id as "parameters" | "console" | "diagnostics")}
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
          </div>
        ) : null}
      </div>
    </section>
  );
}
