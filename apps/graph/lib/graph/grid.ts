export interface GridSettings {
  majorStep: number;
  minorStep: number;
  fadeDistance: number;
}

const NICE_STEP_MULTIPLIERS = [1, 2, 5];

export function getNiceGridStep(distance: number): number {
  const safeDistance = Math.max(1e-6, Math.abs(distance));
  const targetStep = safeDistance / 12;

  const exponent = Math.floor(Math.log10(targetStep));
  const base = Math.pow(10, exponent);

  for (const multiplier of NICE_STEP_MULTIPLIERS) {
    const candidate = base * multiplier;
    if (candidate >= targetStep) {
      return candidate;
    }
  }

  return base * 10;
}

export function getGridSettings(cameraDistance: number): GridSettings {
  const majorStep = getNiceGridStep(cameraDistance);
  const minorStep = majorStep / 5;
  const fadeDistance = clamp(majorStep * 30, 35, 3_000);

  return {
    majorStep,
    minorStep,
    fadeDistance
  };
}

export function snapToGrid(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
    return value;
  }

  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
