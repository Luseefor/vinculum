# Vinculum Product Video (Remotion)

This application is a dedicated Remotion video project designed to produce a cinematic, high-polish product showcase video for **Vinculum**.

## Compositions Included

1. **`ProductShowcase` (16:9 Landscape - 1920x1080, 50s / 1500 frames @ 30fps)**
   - Tailored for YouTube, Product Hunt, Twitter/X, and landing page hero embeds.
2. **`ProductShowcaseVertical` (9:16 Portrait - 1080x1920, 50s / 1500 frames @ 30fps)**
   - Tailored for TikTok, Instagram Reels, and YouTube Shorts.
3. **Individual Scene Compositions** (for quick previewing & fine-tuning):
   - `Scene1-Hook` (Genesis of thought, kinetic formulas)
   - `Scene2-Intro` (Vinculum brand reveal & 3D tilted app window mockup)
   - `Scene3-UnifiedCanvas` (Parametric curve helix & 2D/3D space)
   - `Scene4-Surfaces` (Implicit & explicit surfaces, wireframe toggles)
   - `Scene5-EnginePower` (Rust + WASM engine, WebGPU, vector field streamline simulation)
   - `Scene6-WorkflowExport` (One-click share URLs, 4K PNG, vector SVG, local-first privacy)
   - `Scene7-Outro` (Glowing logo, tagline, open-source GitHub CTA)

## Quickstart

From repository root:

```bash
# Launch interactive Remotion Studio in your browser:
bun run video:dev

# Render full 16:9 landscape product video (out/vinculum-showcase.mp4):
bun run video:build

# Render full 9:16 vertical mobile video (out/vinculum-vertical.mp4):
bun run video:build:vertical
```

Or from within `apps/video`:

```bash
cd apps/video
bun run dev
bun run build
bun run build:vertical
```

## Adding Custom Audio / Voiceover

Place your audio track into:
`apps/video/public/audio/soundtrack.mp3`

And include `<Soundtrack />` in `src/ProductShowcase.tsx` or `src/ProductShowcaseVertical.tsx`.
