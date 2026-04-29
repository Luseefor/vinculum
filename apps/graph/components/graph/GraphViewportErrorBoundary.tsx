"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  reportError,
  type MonitoringFeatureArea
} from "@/lib/monitoring/errorReporting";

interface Props {
  children: ReactNode;
  featureArea?: MonitoringFeatureArea;
  onResetView?: () => void;
  onExportSceneJson?: () => void;
}

interface State {
  hasError: boolean;
  retryKey: number;
}

export default class GraphViewportErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    retryKey: 0
  };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, {
      featureArea: this.props.featureArea ?? "3d-viewport",
      operation: "render",
      details: {
        componentStack: info.componentStack
      }
    });
  }

  private handleRetry = (): void => {
    this.setState((previous) => ({
      hasError: false,
      retryKey: previous.retryKey + 1
    }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="max-w-sm text-sm font-semibold text-[var(--text-primary)]">
            Something went wrong
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
              Try again
            </button>
            <button type="button" className="btn" onClick={this.props.onResetView}>
              Reset view
            </button>
            <button type="button" className="btn" onClick={this.props.onExportSceneJson}>
              Export scene JSON
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={this.state.retryKey} className="h-full min-h-0 w-full">
        {this.props.children}
      </div>
    );
  }
}
