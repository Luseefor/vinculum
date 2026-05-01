"use client";

import type { ReactNode } from "react";

interface EditorAppShellProps {
  header: ReactNode;
  leftSidebar: ReactNode;
  leftSidebarDivider?: ReactNode;
  toolRail: ReactNode;
  workspaceControls: ReactNode;
  workspace: ReactNode;
  rightInspector: ReactNode;
  rightInspectorDivider?: ReactNode;
  bottomDivider?: ReactNode;
  bottomDock: ReactNode;
  statusBar: ReactNode;
}

export default function EditorAppShell({
  header,
  leftSidebar,
  leftSidebarDivider,
  toolRail,
  workspaceControls,
  workspace,
  rightInspector,
  rightInspectorDivider,
  bottomDivider,
  bottomDock,
  statusBar
}: EditorAppShellProps) {
  return (
    <>
      {header}
      <div className="flex min-h-0 flex-1 bg-[var(--editor-shell)]">
        {leftSidebar}
        {leftSidebarDivider}
        {toolRail}
        <main className="relative flex min-w-0 flex-1 flex-col border-l border-r border-[var(--border-subtle)] bg-[var(--editor-shell)] p-3">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-canvas)] shadow-[0_8px_24px_rgba(2,6,23,0.18)]">
            {workspace}
            {workspaceControls}
          </div>
        </main>
        {rightInspectorDivider}
        {rightInspector}
      </div>
      {bottomDivider}
      {bottomDock}
      {statusBar}
    </>
  );
}
