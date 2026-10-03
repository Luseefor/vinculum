"use client";

import { useEffect } from "react";
import Link from "next/link";
import PublicPageShell from "@/components/layout/PublicPageShell";
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

  return <PublicPageShell><section className="public-container public-recovery">
    <p className="public-eyebrow">Something went wrong</p><h1>This page couldn’t load.</h1>
    <p className="public-lead">Try loading it again, or return to the home page.</p>
    <div className="public-cta"><button type="button" onClick={reset} className="public-button public-button-primary">Try again</button><Link href="/" className="public-button public-button-secondary">Go home</Link></div>
  </section></PublicPageShell>;
}
