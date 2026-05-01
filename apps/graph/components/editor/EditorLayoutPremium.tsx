"use client";

import type { ReactNode } from "react";

interface EditorLayoutPremiumProps {
  header: ReactNode;
  sceneNavigator: ReactNode;
  sceneDivider?: ReactNode;
  workspace: ReactNode;
  inspectorDrawer: ReactNode;
  bottomDivider?: ReactNode;
  bottomDock: ReactNode;
  statusBar: ReactNode;
}

export default function EditorLayoutPremium({
  header,
  sceneNavigator,
  sceneDivider,
  workspace,
  inspectorDrawer,
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
        <main className="relative flex min-w-0 flex-1 flex-col border-l border-[var(--border-subtle)] bg-[var(--editor-shell)] p-2.5">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-[var(--border-strong)] bg-[var(--surface-canvas)]">
            {workspace}
            {inspectorDrawer}
          </div>
        </main>
      </div>
      {bottomDivider}
      {bottomDock}
      {statusBar}
    </>
  );
}
