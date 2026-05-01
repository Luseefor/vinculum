import type { AccentPreset } from "@/types/graphUi";

export const toolbarAccentOptions: AccentPreset[] = [
  "indigo",
  "blue",
  "cyan",
  "emerald",
  "green",
  "amber",
  "orange",
  "rose",
  "pink",
  "violet"
];

export const toolbarAccentHex: Record<AccentPreset, string> = {
  indigo: "#6366f1",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  emerald: "#10b981",
  green: "#22c55e",
  amber: "#f59e0b",
  orange: "#f97316",
  rose: "#f43f5e",
  pink: "#ec4899",
  violet: "#8b5cf6"
};
