import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Audio,
  staticFile,
  Img,
} from "remotion";
import katex from "katex";

export const MASTER_DURATION_FRAMES = 1020; // 34.00s @ 30fps

export const VinculumShowcaseMaster: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Helper for KaTeX rendering
  const renderLatex = (latex: string) => {
    try {
      return katex.renderToString(latex, { displayMode: true, throwOnError: false });
    } catch {
      return latex;
    }
  };

  // -------------------------------------------------------------
  // ACT I: THE AXIOM (0 - 120 frames / 0.00s - 4.00s)
  // -------------------------------------------------------------
  const act1Opacity = interpolate(frame, [0, 15, 105, 120], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const act1TextSpring = spring({ frame: frame - 25, fps, config: { damping: 15, mass: 0.8 } });
  const act1FormulaSpring = spring({ frame, fps, config: { damping: 18, mass: 1 } });
  const act1GridProgress = interpolate(frame, [65, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // -------------------------------------------------------------
  // ACT II: DIRECT INSCRIPTION & GYROID EMERGENCE (120 - 345 frames / 4.00s - 11.50s)
  // -------------------------------------------------------------
  const act2Opacity = interpolate(frame, [120, 130, 335, 345], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Typing simulation: frames 120 to 180 (4.0s - 6.0s)
  const typingProgress = interpolate(frame, [126, 175], [0, 3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const typedText = "= 0".slice(0, Math.floor(typingProgress));
  const isSyntaxValid = frame >= 175;

  // Gyroid unfold: frames 195 to 345 (6.5s - 11.5s)
  const gyroidPhase = interpolate(frame, [195, 270, 345], [0, 0.45, 0.80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gyroidOrbitAngle = interpolate(frame, [195, 345], [0, 48]);
  const gyroidCameraPush = interpolate(frame, [195, 345], [1, 1.18]);

  // -------------------------------------------------------------
  // ACT III: THE ANALYTICAL PROBE & VECTOR FLOW (345 - 585 frames / 11.50s - 19.50s)
  // -------------------------------------------------------------
  const act3Opacity = interpolate(frame, [345, 355, 575, 585], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Sub-shot 3.1: Saddle Surface + Tangent Plane (345 - 444 frames / 11.5s - 14.8s)
  const saddlePhase = frame < 444;
  const probeSnap = spring({ frame: frame - 380, fps, config: { damping: 14, mass: 0.6 } });

  // Sub-shot 3.2 & 3.3: 3D Vector Field & Streamlines (444 - 585 frames / 14.8s - 19.5s)
  const streamlineProgress = interpolate(frame, [510, 580], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // -------------------------------------------------------------
  // ACT IV: SPATIAL SYNTHESIS & QUAD STUDIO (585 - 795 frames / 19.50s - 26.50s)
  // -------------------------------------------------------------
  const act4Opacity = interpolate(frame, [585, 595, 785, 795], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // 585 - 660 frames: Linear transform shear
  const shearProgress = interpolate(frame, [595, 650], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // 660 - 795 frames: Quad viewport split
  const isQuadSplit = frame >= 660;
  const handleDragX = interpolate(frame, [735, 780], [0, 85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // -------------------------------------------------------------
  // ACT V: MONOGRAPH CLOSE & PLANNED SILENCE (795 - 1020 frames / 26.50s - 34.00s)
  // -------------------------------------------------------------
  const act5WorkspaceOpacity = interpolate(frame, [795, 805, 875, 885], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const act5MonographOpacity = interpolate(frame, [885, 900, 915, 920], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // From frame 915 (30.50s) to 1020 (34.00s): COMPLETE OBSIDIAN BLACKNESS

  return (
    <div className="relative w-full h-full bg-[#06080e] text-white overflow-hidden select-none font-sans">
      {/* 4-Stem Discrete Acoustic Foley Score */}
      <Audio src={staticFile("audio/master-soundtrack.wav")} />

      {/* ========================================================= */}
      {/* ACT I: THE AXIOM (0.00s - 4.00s)                          */}
      {/* ========================================================= */}
      {frame < 120 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ opacity: act1Opacity }}
        >
          {/* Subtle coordinate depth grid lines emerging */}
          <div
            className="absolute inset-0 flex items-center justify-center opacity-30"
            style={{
              transform: `scale(${1 + act1GridProgress * 0.12}) perspective(800px) rotateX(45deg)`,
            }}
          >
            <div
              className="w-[1200px] h-[1200px] border border-slate-700/40 rounded-full"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(148, 163, 184, 0.15) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
          </div>

          {/* Algebraic Formula */}
          <div
            className="relative z-10 text-slate-300 drop-shadow-md text-3xl mb-8"
            style={{
              transform: `translateY(${(1 - act1FormulaSpring) * 16}px)`,
              opacity: act1FormulaSpring,
            }}
            dangerouslySetInnerHTML={{
              __html: renderLatex(
                "\\sin(x)\\cos(y) + \\sin(y)\\cos(z) + \\sin(z)\\cos(x) = 0"
              ),
            }}
          />

          {/* Stripe Press Editorial Proposition */}
          <div
            className="relative z-10 text-xl font-normal tracking-[-0.02em] text-slate-200"
            style={{
              opacity: act1TextSpring,
              transform: `translateY(${(1 - act1TextSpring) * 10}px)`,
            }}
          >
            Every equation defines a geometry.
          </div>

          {/* Monospace Metadata */}
          <div className="absolute bottom-12 text-[11px] font-mono tracking-[0.2em] text-slate-500 uppercase">
            Vinculum // Mathematical Instrument // Three.js WebGPU
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ACT II: DIRECT INSCRIPTION & GYROID EMERGENCE (4s - 11.5s) */}
      {/* ========================================================= */}
      {frame >= 120 && frame < 345 && (
        <div className="absolute inset-0" style={{ opacity: act2Opacity }}>
          {/* Sub-shot 2.1: Macro Inscription (120 - 195 frames / 4.0s - 6.5s) */}
          {frame < 195 && (
            <div className="w-full h-full flex items-center justify-center bg-[#070a14]">
              {/* Dark Titanium Inspector Header */}
              <div className="w-[840px] bg-[#0c101d] border border-slate-800/80 rounded-xl p-8 shadow-2xl">
                <div className="flex items-center justify-between pb-5 border-b border-slate-800/60 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
                    <span className="text-xs font-mono tracking-[0.15em] text-slate-400 uppercase">
                      Inspector // Equation Definition // Implicit Manifold
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-mono px-2.5 py-1 rounded transition-colors ${
                      isSyntaxValid
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {isSyntaxValid ? "VERIFIED AST" : "PARSING..."}
                  </span>
                </div>

                {/* Formula Input Row */}
                <div className="flex items-center gap-4 bg-[#141926] border border-slate-700/50 rounded-lg p-5">
                  <span className="text-sm font-mono text-cyan-400">F(x,y,z) =</span>
                  <div className="flex-1 flex items-center text-lg text-slate-200">
                    <span
                      dangerouslySetInnerHTML={{
                        __html: renderLatex(
                          "\\sin(x)\\cos(y) + \\sin(y)\\cos(z) + \\sin(z)\\cos(x)"
                        ),
                      }}
                    />
                    <span className="ml-2 text-cyan-300 font-mono font-semibold">
                      {typedText}
                    </span>
                    <span className="w-0.5 h-5 bg-cyan-400 ml-1 animate-pulse" />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>COMPILER: Rust WASM Postfix VM</span>
                  <span>EVALUATION BUDGET: &lt; 0.82ms</span>
                </div>
              </div>
            </div>
          )}

          {/* Sub-shot 2.2 & 2.3: Schön Gyroid Emergence & Dilation (195 - 345 frames) */}
          {frame >= 195 && (
            <div className="w-full h-full relative flex">
              {/* 3D Canvas Viewport (~68% width) */}
              <div
                className="flex-1 h-full relative overflow-hidden bg-[#06080e] flex items-center justify-center"
                style={{
                  transform: `scale(${gyroidCameraPush})`,
                }}
              >
                {/* Real-time Schön Gyroid SVG/Isometric Visualization */}
                <svg
                  className="w-[900px] h-[900px] drop-shadow-[0_20px_50px_rgba(6,182,212,0.12)]"
                  viewBox="-300 -300 600 600"
                  style={{
                    transform: `rotate(${gyroidOrbitAngle * 0.4}deg)`,
                  }}
                >
                  <defs>
                    <linearGradient id="gyroidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                      <stop offset="50%" stopColor="#0284c7" stopOpacity="0.65" />
                      <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
                    </linearGradient>
                    <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#7dd3fc" />
                      <stop offset="100%" stopColor="#0369a1" />
                    </linearGradient>
                  </defs>

                  {/* Adaptive Coordinate Grid */}
                  <g opacity="0.25">
                    {[-200, -100, 0, 100, 200].map((v) => (
                      <React.Fragment key={v}>
                        <line x1={v} y1="-280" x2={v} y2="280" stroke="#475569" strokeWidth="1" />
                        <line x1="-280" y1={v} x2="280" y2={v} stroke="#475569" strokeWidth="1" />
                      </React.Fragment>
                    ))}
                  </g>

                  {/* Gyroid Manifold Tunnels (Parametric level set simulation) */}
                  {Array.from({ length: 16 }).map((_, i) => {
                    const r = 60 + i * 14 + gyroidPhase * 45;
                    const pathD = `M ${-r} 0 C ${-r} ${r * 0.75} ${-r * 0.75} ${r} 0 ${r} C ${r * 0.75} ${r} ${r} ${r * 0.75} ${r} 0 C ${r} ${-r * 0.75} ${r * 0.75} ${-r} 0 ${-r} C ${-r * 0.75} ${-r} ${-r} ${-r * 0.75} ${-r} 0 Z`;
                    return (
                      <path
                        key={i}
                        d={pathD}
                        fill="none"
                        stroke="url(#gyroidGrad)"
                        strokeWidth={i % 2 === 0 ? "2.5" : "1.2"}
                        strokeDasharray={i % 3 === 0 ? "8 4" : "none"}
                        transform={`rotate(${i * 22.5 + gyroidOrbitAngle}) scale(${1 + (i % 2) * 0.08})`}
                      />
                    );
                  })}
                </svg>

                {/* Telemetry Badge */}
                <div className="absolute bottom-8 left-8 bg-[#0b0f19]/80 backdrop-blur border border-slate-800 rounded px-3 py-2 text-[10px] font-mono text-slate-400">
                  <span>VOXELS: 110,592 // TETRAHEDRA: 663,552 // EVAL: 0.82ms</span>
                </div>
              </div>

              {/* Inspector Panel (~32% width) */}
              <div className="w-[420px] h-full bg-[#0a0d17] border-l border-slate-800/80 p-8 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-mono tracking-[0.15em] text-slate-500 uppercase mb-4">
                    Object Inspector
                  </div>
                  <h3 className="text-lg font-medium text-slate-200 mb-6">Schön Gyroid (Implicit)</h3>

                  {/* Active Parameter Slider */}
                  <div className="bg-[#111624] border border-slate-700/60 rounded-lg p-5 mb-6">
                    <div className="flex justify-between items-center text-xs font-mono text-slate-300 mb-3">
                      <span>Iso-level constant (a)</span>
                      <span className="text-cyan-400 font-semibold">{gyroidPhase.toFixed(2)}</span>
                    </div>
                    {/* Visual Slider Bar */}
                    <div className="w-full h-2 bg-slate-800 rounded-full relative overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${(gyroidPhase / 0.8) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2">
                      <span>0.00</span>
                      <span>0.80</span>
                    </div>
                  </div>

                  {/* Equation Display */}
                  <div
                    className="p-4 bg-[#0d121f] rounded border border-slate-800 text-xs text-slate-300"
                    dangerouslySetInnerHTML={{
                      __html: renderLatex(
                        `\\sin x\\cos y + \\sin y\\cos z + \\sin z\\cos x = ${gyroidPhase.toFixed(2)}`
                      ),
                    }}
                  />
                </div>

                <div className="text-[10px] font-mono text-slate-600">
                  REAL-TIME MARCHING TETRAHEDRA // LOCKED 60 FPS
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ACT III: THE ANALYTICAL PROBE & VECTOR FLOW (11.5s - 19.5s)*/}
      {/* ========================================================= */}
      {frame >= 345 && frame < 585 && (
        <div className="absolute inset-0" style={{ opacity: act3Opacity }}>
          {/* Sub-shot 3.1: Hyperbolic Saddle + Tangent Probe (345 - 444 frames) */}
          {saddlePhase ? (
            <div className="w-full h-full relative flex bg-[#06080e]">
              <div className="flex-1 h-full flex items-center justify-center relative">
                {/* Hyperbolic Saddle Visualization */}
                <svg className="w-[800px] h-[800px]" viewBox="-300 -300 600 600">
                  <g opacity="0.3">
                    <line x1="-280" y1="0" x2="280" y2="0" stroke="#475569" strokeWidth="1" />
                    <line x1="0" y1="-280" x2="0" y2="280" stroke="#475569" strokeWidth="1" />
                  </g>

                  {/* Saddle Contours */}
                  {[-120, -80, -40, 0, 40, 80, 120].map((c, i) => (
                    <path
                      key={i}
                      d={`M -220 ${c - 80} Q 0 ${c + 80} 220 ${c - 80}`}
                      fill="none"
                      stroke={c >= 0 ? "#38bdf8" : "#818cf8"}
                      strokeWidth="2"
                      opacity="0.75"
                    />
                  ))}

                  {/* Armed Pick Tangent Plane Quad Patch */}
                  <g
                    transform="translate(45, -30)"
                    style={{
                      transformOrigin: "45px -30px",
                      transform: `scale(${probeSnap})`,
                      opacity: probeSnap,
                    }}
                  >
                    <polygon
                      points="-70,-40 70,-40 50,40 -90,40"
                      fill="rgba(56, 189, 248, 0.22)"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />
                    {/* Normal Vector Arrow */}
                    <line x1="-10" y1="0" x2="-10" y2="-90" stroke="#f43f5e" strokeWidth="3" />
                    <polygon points="-16,-90 -10,-105 -4,-90" fill="#f43f5e" />
                    <circle cx="-10" cy="0" r="5" fill="#f43f5e" />
                  </g>
                </svg>

                {/* Analytical Readout Pill */}
                <div
                  className="absolute top-12 left-12 bg-[#0d121f]/90 border border-slate-700/80 rounded-lg p-4 font-mono text-xs text-slate-300"
                  style={{ opacity: probeSnap }}
                >
                  <div className="text-cyan-400 font-semibold mb-2">ARMED DIFFERENTIAL PROBE</div>
                  <div>Point: (1.50, 1.00, 0.625)</div>
                  <div>∂z/∂x = 1.500 | ∂z/∂y = -1.000</div>
                  <div className="mt-1 text-slate-400">
                    Tangent: 1.50(x - 1.5) - 1.00(y - 1.0) - (z - 0.625) = 0
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Sub-shot 3.2 & 3.3: 3D Vector Field & Streamlines (444 - 585 frames)
            <div className="w-full h-full relative flex items-center justify-center bg-[#06080e]">
              <svg className="w-[960px] h-[960px]" viewBox="-400 -400 800 800">
                {/* 1,728 Instanced Vector Arrows Grid Simulation */}
                {Array.from({ length: 12 }).map((_, xi) =>
                  Array.from({ length: 12 }).map((_, yi) => {
                    const x = (xi - 5.5) * 55;
                    const y = (yi - 5.5) * 55;
                    const r = Math.sqrt(x * x + y * y) + 1;
                    const vx = -y / r;
                    const vy = x / r;
                    const len = 18;
                    return (
                      <g key={`${xi}-${yi}`} transform={`translate(${x}, ${y})`}>
                        <line
                          x1={0}
                          y1={0}
                          x2={vx * len}
                          y2={vy * len}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                          opacity="0.45"
                        />
                      </g>
                    );
                  })
                )}

                {/* Autonomous RK4 Streamlines Spiraling Inward */}
                {Array.from({ length: 12 }).map((_, si) => {
                  const angle = (si / 12) * Math.PI * 2;
                  const maxR = 280;
                  const currentR = maxR - streamlineProgress * 160;
                  const currentAngle = angle + streamlineProgress * Math.PI * 1.8;
                  const cx = Math.cos(currentAngle) * currentR;
                  const cy = Math.sin(currentAngle) * currentR;

                  return (
                    <g key={si}>
                      <path
                        d={`M ${Math.cos(angle) * maxR} ${Math.sin(angle) * maxR} Q ${Math.cos(angle + 0.8) * (maxR * 0.7)} ${Math.sin(angle + 0.8) * (maxR * 0.7)} ${cx} ${cy}`}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="3"
                        strokeDasharray="6 3"
                        opacity={0.3 + streamlineProgress * 0.7}
                      />
                      {/* Arrowhead at Tip */}
                      <circle cx={cx} cy={cy} r="4" fill="#38bdf8" />
                    </g>
                  );
                })}
              </svg>

              {/* Streamline HUD tag */}
              <div className="absolute bottom-10 right-10 bg-[#0d121f]/90 border border-slate-700/80 rounded px-4 py-2 font-mono text-xs text-slate-300">
                <span className="text-cyan-400 font-semibold">RUNGE-KUTTA 4 (RK4)</span>
                <span className="ml-2 text-slate-500">// ADAPTIVE ODE INTEGRATION</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ACT IV: SPATIAL SYNTHESIS & QUAD STUDIO (19.5s - 26.5s)   */}
      {/* ========================================================= */}
      {frame >= 585 && frame < 795 && (
        <div className="absolute inset-0 bg-[#06080e]" style={{ opacity: act4Opacity }}>
          {!isQuadSplit ? (
            // 3D Linear Transform Shearing Parallelepiped (585 - 660 frames)
            <div className="w-full h-full flex items-center justify-center relative">
              <svg className="w-[840px] h-[840px]" viewBox="-350 -350 700 700">
                {/* Reference Coordinate Axes */}
                <line x1="-280" y1="0" x2="280" y2="0" stroke="#334155" strokeWidth="1.5" />
                <line x1="0" y1="-280" x2="0" y2="280" stroke="#334155" strokeWidth="1.5" />

                {/* Deformed Parallelepiped under Matrix A */}
                <polygon
                  points={`0,0 ${160 + shearProgress * 80},-40 ${200 + shearProgress * 120},140 ${40 + shearProgress * 40},180`}
                  fill="rgba(56, 189, 248, 0.15)"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                />

                {/* Real Invariant Amber Eigenvalue Ray */}
                <line
                  x1="-300"
                  y1={-300 * (0.6 + shearProgress * 0.2)}
                  x2="300"
                  y2={300 * (0.6 + shearProgress * 0.2)}
                  stroke="#f59e0b"
                  strokeWidth="3"
                  strokeDasharray="8 4"
                />

                {/* Eigendirection Label */}
                <text x="140" y="80" fill="#f59e0b" className="text-xs font-mono font-bold">
                  Av = λv (λ = 1.36)
                </text>
              </svg>

              <div className="absolute top-12 left-12 bg-[#0d121f] border border-slate-700/80 rounded p-4 font-mono text-xs text-slate-300">
                <div className="text-amber-400 font-semibold mb-1">LINEAR TRANSFORMATION STUDIO</div>
                <div>Matrix A: [[1.2, 0.4, 0.0], [0.3, 1.1, 0.0], [0.0, 0.0, 1.0]]</div>
                <div>det(A) = 1.360 // Invariant Eigenspace</div>
              </div>
            </div>
          ) : (
            // Quad Orthographic Viewport Studio (660 - 795 frames)
            <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1 p-2 bg-slate-900/60">
              {/* Perspective Pane */}
              <div className="relative bg-[#070a14] border border-slate-800 rounded flex items-center justify-center">
                <span className="absolute top-3 left-3 text-[11px] font-mono text-slate-400 uppercase">
                  Perspective
                </span>
                <div className="w-24 h-24 border border-cyan-400/60 rotate-45" />
              </div>

              {/* Top (XY) Pane - With Direct Handle Drag */}
              <div className="relative bg-[#070a14] border border-cyan-500/40 rounded flex items-center justify-center">
                <span className="absolute top-3 left-3 text-[11px] font-mono text-cyan-400 uppercase">
                  Top (XY) // Active Handle
                </span>
                <div
                  className="w-4 h-4 bg-cyan-400 rounded-full border-2 border-white shadow-lg cursor-pointer"
                  style={{ transform: `translate(${handleDragX}px, ${-handleDragX * 0.4}px)` }}
                />
                <line x1="0" y1="0" x2={handleDragX} y2={-handleDragX * 0.4} stroke="#38bdf8" />
              </div>

              {/* Front (XZ) Pane */}
              <div className="relative bg-[#070a14] border border-slate-800 rounded flex items-center justify-center">
                <span className="absolute top-3 left-3 text-[11px] font-mono text-slate-400 uppercase">
                  Front (XZ)
                </span>
                <div className="w-24 h-2 border-b-2 border-slate-500" />
              </div>

              {/* Right (YZ) Pane */}
              <div className="relative bg-[#070a14] border border-slate-800 rounded flex items-center justify-center">
                <span className="absolute top-3 left-3 text-[11px] font-mono text-slate-400 uppercase">
                  Right (YZ)
                </span>
                <div className="h-24 w-2 border-r-2 border-slate-500" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ACT V: MONOGRAPH CLOSE & PLANNED SILENCE (26.5s - 34.0s)  */}
      {/* ========================================================= */}
      {frame >= 795 && (
        <div className="absolute inset-0 bg-[#06080e] flex items-center justify-center">
          {/* Sub-shot 5.1: Desktop Application Workspace (795 - 885 frames) */}
          {frame < 885 && (
            <div
              className="w-full h-full flex flex-col items-center justify-center p-12"
              style={{ opacity: act5WorkspaceOpacity }}
            >
              <div className="text-xl font-normal tracking-[-0.02em] text-slate-200 mb-6">
                A unified instrument for spatial mathematics.
              </div>
              <div className="w-[90%] max-w-[1400px] h-[720px] rounded-xl overflow-hidden border border-slate-700/60 shadow-2xl relative">
                <Img
                  src={staticFile("product/editor-helix-full.png")}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Sub-shot 5.2: Monograph Brand Lockup (885 - 915 frames) */}
          {frame >= 885 && frame < 920 && (
            <div
              className="flex flex-col items-center justify-center"
              style={{ opacity: act5MonographOpacity }}
            >
              <h1 className="text-6xl font-bold tracking-[0.25em] text-white mb-4">
                VINCULUM
              </h1>
              <div className="text-xs font-mono tracking-[0.35em] text-slate-400 uppercase mb-8">
                Where Notation Becomes Space
              </div>
              <div className="text-sm font-mono tracking-[0.15em] text-cyan-400">
                vinculum.dev
              </div>
            </div>
          )}

          {/* 915 to 1020 frames (30.50s - 34.00s): COMPLETE NEGATIVE SILENCE INTO BLACK */}
        </div>
      )}
    </div>
  );
};
