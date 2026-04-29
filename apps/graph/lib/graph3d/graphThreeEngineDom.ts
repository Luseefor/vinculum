import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { useEditorStore } from "@/lib/store/editorStore";

export function getParameterSignature(): string {
  return useEditorStore
    .getState()
    .parameters.map((parameter) => `${parameter.id}:${parameter.value}`)
    .join("|");
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function shouldShowPerfBadge(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("perf") === "1") {
      return true;
    }
    // Primary source: persisted editor preference.
    const showFromStore = useEditorStore.getState().showPerfHud;
    if (showFromStore) return true;

    // Backward-compatible fallback for older localStorage-based toggles.
    return window.localStorage.getItem("vinculum:graph3d:showPerf") === "1";
  } catch {
    return false;
  }
}

export function createAxisLabelDiv(text: string): HTMLDivElement {
  const div = document.createElement("div");
  div.textContent = text;
  div.className =
    "pointer-events-none rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide shadow-sm";
  return div;
}

export function applyLabelStyles(
  labelX: HTMLDivElement,
  labelY: HTMLDivElement,
  labelZ: HTMLDivElement,
  tokens: ReturnType<typeof getGraphThemeTokens>
) {
  const style = {
    borderColor: tokens.axisLabelBorder,
    backgroundColor: tokens.axisLabelBg,
    color: tokens.axisLabelText
  };
  for (const el of [labelX, labelY, labelZ]) {
    el.style.borderColor = style.borderColor;
    el.style.backgroundColor = style.backgroundColor;
    el.style.color = style.color;
  }
}
