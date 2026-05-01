"use client";

import { useEffect, type ReactNode } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { getToken, getHost } from "@/lib/analytics/posthog";

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const token = getToken();
    if (typeof window !== "undefined" && token) {
      posthog.init(token, {
        api_host: getHost(),
        person_profiles: "identified_only", // or "always"
        capture_pageview: false, // Handled manually for route changes
        capture_pageleave: true
      });
    }
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
