"use client";

import { Panel } from "@/components/showcase/ui";

const cssSnippet = `:root {
  --bg-primary: #0b1021;
  --bg-secondary: #0f172a;
  --bg-tertiary: #111827;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --border-color: rgba(148,163,184,0.16);
  --accent-primary: #6366f1;
  --accent-secondary: #22d3ee;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  --radius: 0.75rem;
  --panel-opacity: 0.65;
  --panel-blur: 12px;
}`;

export default function CssVariablesCard() {
  return (
    <Panel className="details-card css-structure-card">
      <h3>CSS VARIABLE STRUCTURE</h3>
      <div className="css-structure-layout">
        <pre>{cssSnippet}</pre>
        <p>
          All colors are CSS variables for easy theming.
          <br />
          Change once, applies everywhere.
        </p>
      </div>
    </Panel>
  );
}
