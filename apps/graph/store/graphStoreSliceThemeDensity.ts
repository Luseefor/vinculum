import {
  loadStoredAccentPreset,
  loadStoredDensity,
  loadStoredThemeMode,
  persistAccentPreset,
  persistDensity,
  persistThemeMode
} from "@/lib/theme/themeStorage";
import { getNextThemeMode } from "./graphStoreThemeCycle";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function buildThemeDensitySlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  | "setThemeMode"
  | "setAccentPreset"
  | "setDensity"
  | "hydrateThemeMode"
  | "hydrateAccentPreset"
  | "hydrateDensity"
  | "cycleThemeMode"
> {
  return {
    setThemeMode: (mode) => {
      persistThemeMode(mode);
      set((state) => ({
        ui: {
          ...state.ui,
          themeMode: mode
        }
      }));
    },

    setAccentPreset: (preset) => {
      persistAccentPreset(preset);
      set((state) => ({
        ui: {
          ...state.ui,
          accentPreset: preset
        }
      }));
    },
    setDensity: (density) => {
      persistDensity(density);
      set((state) => ({
        ui: {
          ...state.ui,
          density
        }
      }));
    },

    hydrateThemeMode: () => {
      const mode = loadStoredThemeMode();
      set((state) => {
        if (state.ui.themeMode === mode) {
          return state;
        }

        return {
          ui: {
            ...state.ui,
            themeMode: mode
          }
        };
      });
    },

    hydrateAccentPreset: () => {
      const preset = loadStoredAccentPreset();
      set((state) => {
        if (state.ui.accentPreset === preset) {
          return state;
        }

        return {
          ui: {
            ...state.ui,
            accentPreset: preset
          }
        };
      });
    },
    hydrateDensity: () => {
      const density = loadStoredDensity();
      set((state) => {
        if (state.ui.density === density) {
          return state;
        }
        return {
          ui: {
            ...state.ui,
            density
          }
        };
      });
    },

    cycleThemeMode: () => {
      set((state) => {
        const nextThemeMode = getNextThemeMode(state.ui.themeMode);
        persistThemeMode(nextThemeMode);

        return {
          ui: {
            ...state.ui,
            themeMode: nextThemeMode
          }
        };
      });
    }
  };
}
