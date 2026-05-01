"use client";

import { IconEye, IconFilter, IconLock, IconMore, IconSearch } from "@/components/showcase/icons";
import { Badge, Button, IconButton, Panel } from "@/components/showcase/ui";

interface ScenePanelProps {
  onAddSurface: () => void;
  onAddCurve: () => void;
  onAddSphere: () => void;
  onAddCylinder: () => void;
  onAddPlane: () => void;
  onAddPoint: () => void;
}

type ObjectRowItem = {
  id: string;
  name: string;
  type: string;
  color: string;
  selected?: boolean;
  locked?: boolean;
};

const rows: ObjectRowItem[] = [
  { id: "surface", name: "Surface #1", type: "Surface", color: "#3b82f6", selected: true },
  { id: "curve", name: "Curve #1", type: "Curve", color: "#4ade80" },
  { id: "sphere", name: "Sphere #1", type: "Sphere", color: "#7c3aed" },
  { id: "cylinder", name: "Cylinder #1", type: "Cylinder", color: "#ef4444" },
  { id: "plane", name: "Plane #1", type: "Plane", color: "#06b6d4", locked: true },
  { id: "point", name: "Point #1", type: "Point", color: "#f59e0b" }
];

export default function ScenePanel({
  onAddSurface,
  onAddCurve,
  onAddSphere,
  onAddCylinder,
  onAddPlane,
  onAddPoint
}: ScenePanelProps) {
  return (
    <Panel className="scene-panel">
      <div className="scene-panel-header">
        <p className="panel-kicker">Scene</p>
        <Button className="scene-add-btn" onClick={onAddSurface}>
          + Add Object
          <span className="icon-14"><IconMore /></span>
        </Button>
        <div className="scene-search-row">
          <label className="scene-search-wrap">
            <span className="icon-14"><IconSearch /></span>
            <input type="text" placeholder="Search objects..." />
          </label>
          <IconButton icon={<span className="icon-14"><IconFilter /></span>} className="v-btn-sm" ariaLabel="Filter objects" />
        </div>
      </div>

      <div className="scene-list" role="list" aria-label="Objects list">
        {rows.map((item) => (
          <div key={item.id} className={item.selected ? "scene-row scene-row-selected" : "scene-row"} role="listitem">
            <span className="scene-dot" style={{ backgroundColor: item.color }} />
            <div className="scene-meta">
              <span className="scene-name">{item.name}</span>
              <span className="scene-type">{item.type}</span>
            </div>
            <span className="scene-row-icon"><IconEye /></span>
            {item.locked ? <span className="scene-row-icon"><IconLock /></span> : null}
            <span className="scene-row-icon"><IconMore /></span>
          </div>
        ))}
      </div>

      <div className="scene-quick-add">
        <p className="panel-kicker">Quick Add</p>
        <div className="scene-quick-grid">
          <Button className="scene-chip" onClick={onAddSurface}>Surface</Button>
          <Button className="scene-chip" onClick={onAddCurve}>Curve</Button>
          <Button className="scene-chip" onClick={onAddSphere}>Sphere</Button>
          <Button className="scene-chip" onClick={onAddCylinder}>Cylinder</Button>
          <Button className="scene-chip" onClick={onAddPlane}>Plane</Button>
          <Button className="scene-chip" onClick={onAddPoint}>Point</Button>
        </div>
        <Badge className="scene-quick-hint">Scene objects, quick add, layers.</Badge>
      </div>
    </Panel>
  );
}
