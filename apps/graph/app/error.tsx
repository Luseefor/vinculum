"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring/errorReporting";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, {
      featureArea: "app-router",
      operation: "route-error",
      details: {
        digest: error.digest
      }
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-6">
          <div className="panel w-full max-w-md p-6 text-center">
            <h1 className="text-base font-semibold text-[var(--text-primary)]">Something went wrong</h1>
            <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
              Try again to reload the editor shell safely.
            </p>
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={() => reset()} className="btn btn-primary">
                Try again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
