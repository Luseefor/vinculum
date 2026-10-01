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
  bottomDivider?: ReactNode;
  bottomDock: ReactNode;
  statusBar: ReactNode;
}

export default function EditorLayoutPremium({
  header,
  canvasToolbar,
  sceneNavigator,
  sceneDivider,
  workspace,
  inspectorDrawer,
  inspectorPanel,
  inspectorDivider,
  bottomDivider,
  bottomDock,
  statusBar
}: EditorLayoutPremiumProps) {
  return (
    <>
      {header}
      <div className="flex min-h-0 flex-1 bg-[var(--editor-shell)]">
        {sceneNavigator}
        {sceneDivider}
        <main className="relative flex min-w-0 flex-1 flex-col bg-[var(--editor-shell)] p-3">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-canvas)] shadow-[var(--shadow-card)]">
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
      {bottomDivider}
      {bottomDock}
      {statusBar}
    </>
  );
}
