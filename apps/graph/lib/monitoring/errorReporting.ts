export type MonitoringFeatureArea =
  | "2d-viewport"
  | "3d-viewport"
  | "expression-eval"
  | "scene-import"
  | "export"
  | "onboarding"
  | "share-link"
  | "editor-shell"
  | "app-router"
  | string;

export interface MonitoringContext {
  featureArea: MonitoringFeatureArea;
  objectId?: string;
  objectKind?: string;
  schemaVersion?: number;
  operation?: string;
  details?: Record<string, unknown>;
}

export interface NormalizedError {
  name: string;
  message: string;
  stack?: string;
}

export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "Unexpected error.",
      stack: error.stack
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error
    };
  }

  if (isRecord(error) && typeof error.message === "string") {
    return {
      name: typeof error.name === "string" ? error.name : "Error",
      message: error.message,
      stack: typeof error.stack === "string" ? error.stack : undefined
    };
  }

  return {
    name: "UnknownError",
    message: "Unexpected error."
  };
}

export function reportError(error: unknown, context: MonitoringContext): NormalizedError {
  const normalized = normalizeError(error);
  sendToExternalProvider("error", normalized, context);
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console -- development diagnostics only
    console.error("[monitoring:error]", normalized.message, context);
  }
  return normalized;
}

export function reportWarning(message: string, context: MonitoringContext): void {
  const normalized = normalizeError(message);
  sendToExternalProvider("warning", normalized, context);
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console -- development diagnostics only
    console.warn("[monitoring:warning]", message, context);
  }
}

function sendToExternalProvider(
  level: "error" | "warning",
  normalized: NormalizedError,
  context: MonitoringContext
): void {
  const maybeSentry = getSentryAdapter();
  if (!maybeSentry) {
    return;
  }

  try {
    maybeSentry.capture(level, normalized, context);
  } catch {
    // Never let monitoring transport crash application flows.
  }
}

function getSentryAdapter():
  | {
      capture: (
        level: "error" | "warning",
        normalized: NormalizedError,
        context: MonitoringContext
      ) => void;
    }
  | null {
  const globalObject = globalThis as unknown as {
    Sentry?: {
      captureException?: (error: Error, scope?: unknown) => void;
      captureMessage?: (message: string, scope?: unknown) => void;
      withScope?: (callback: (scope: { setExtras?: (extras: Record<string, unknown>) => void; setLevel?: (level: string) => void }) => void) => void;
    };
  };

  if (!globalObject.Sentry) {
    return null;
  }

  return {
    capture: (level, normalized, context) => {
      const sentry = globalObject.Sentry;
      if (!sentry) {
        return;
      }
      if (typeof sentry.withScope === "function") {
        sentry.withScope((scope) => {
          scope.setLevel?.(level);
          scope.setExtras?.({ ...context, errorName: normalized.name });
          if (level === "warning" && typeof sentry.captureMessage === "function") {
            sentry.captureMessage(normalized.message);
            return;
          }
          if (typeof sentry.captureException === "function") {
            sentry.captureException(new Error(normalized.message));
          }
        });
        return;
      }
      if (level === "warning" && typeof sentry.captureMessage === "function") {
        sentry.captureMessage(normalized.message, { extra: context });
        return;
      }
      if (typeof sentry.captureException === "function") {
        sentry.captureException(new Error(normalized.message), { extra: context });
      }
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
