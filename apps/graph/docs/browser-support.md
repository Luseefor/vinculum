# Browser support (Vinculum Graph)

This app targets modern evergreen browsers. Older engines still get usable UI because **`color-mix()` is optional**: base styles use solid `var(--…)` colors, and enhanced blending is applied only inside `@supports (background: color-mix(in srgb, white 50%, black 50%))` in `app/globals.css`.

## Recommended minimum versions

| Feature | Chrome | Safari | Firefox | Edge |
|--------|--------|--------|---------|------|
| Baseline layout, React 18, Zustand | 90+ | 15.4+ | 95+ | 90+ |
| `color-mix()` (refined borders, inputs, expression row tint) | 111+ | 16.2+ | 113+ | 111+ |
| `<canvas>` 2D + wheel `preventDefault` | Current | Current | Current | Current |
| Pointer events / `setPointerCapture` (touch pan on 2D canvas) | Current | 13+ | Current | Current |

## WebViews and enterprise

Embedded WebViews often lag desktop Safari/Chrome. If `color-mix` is unsupported, the UI uses the fallbacks above (slightly flatter borders and backgrounds). Functionality is unchanged.

## CSS variables

Theming relies on custom properties in `:root` and `[data-theme="light"]`. No IE11 support.

## Testing

Automated tests run in **jsdom** (Vitest); they do not exercise layout or `color-mix` parsing in a real browser matrix.
