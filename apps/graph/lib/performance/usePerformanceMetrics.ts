"use client";

import { useSyncExternalStore } from "react";
import type { PerformanceMetricsSnapshot } from "./performanceMetrics";
import { getLatestPerformanceMetricsSnapshot, subscribePerformanceMetrics } from "./performanceMetrics";

export function usePerformanceMetricsSnapshot(): PerformanceMetricsSnapshot {
  return useSyncExternalStore(
    (onStoreChange) => subscribePerformanceMetrics(onStoreChange),
    () => getLatestPerformanceMetricsSnapshot(),
    () => getLatestPerformanceMetricsSnapshot()
  );
}

