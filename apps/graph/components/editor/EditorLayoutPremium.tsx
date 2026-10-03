"use client";

import type { ReactNode } from "react";

interface EditorLayoutPremiumProps {
  header: ReactNode;
  canvasToolbar?: ReactNode;
  sceneNavigator: ReactNode;
  sceneDivider?: ReactNode;
  workspace: ReactNode;
  inspectorDrawer: ReactNode;
  inspectorPanel?: ReactNode;
  inspectorDivider?: ReactNode;
}

export default function EditorLayoutPremium({
  header,
  canvasToolbar,
  sceneNavigator,
  sceneDivider,
  workspace,
  inspectorDrawer,
  inspectorPanel,
  inspectorDivider
}: EditorLayoutPremiumProps) {
  return (
    <>
      {header}
      <div className="flex min-h-0 flex-1 bg-[var(--editor-shell)]">
        {sceneNavigator}
        {sceneDivider}
        <main className="relative flex min-w-0 flex-1 flex-col bg-[var(--surface-canvas)]">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface-canvas)]">
            {canvasToolbar}
            <div className="relative min-h-0 flex-1">
              {workspace}
              {inspectorDrawer}
            </div>
          </div>
        </main>
        {inspectorDivider}
        {inspectorPanel}
      </div>
    </>
  );
}
