import type { GraphUiState } from "@/types/graphUi";

const PROBE_PIN_COLORS = [
  "#f472b6",
  "#22c55e",
  "#38bdf8",
  "#f59e0b",
  "#a78bfa",
  "#fb7185",
  "#34d399",
  "#60a5fa"
] as const;

export function createProbePin(
  world: { x: number; y: number; z: number },
  index: number
): GraphUiState["probePins"][number] {
  return {
    id: `probe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    color: PROBE_PIN_COLORS[Math.abs(index) % PROBE_PIN_COLORS.length] ?? "#f472b6",
    world
  };
}
