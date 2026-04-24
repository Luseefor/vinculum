"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
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
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console -- surfaced only in development
      console.error("Graph viewport error:", error, info.componentStack);
    }
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
            Something went wrong while rendering the graph.
          </p>
          <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
            Try again
          </button>
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
