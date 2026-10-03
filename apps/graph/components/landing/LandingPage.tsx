"use client";

import Link from "next/link";
import { useEffect } from "react";
import PublicPageShell from "@/components/layout/PublicPageShell";
import { MathExpression } from "@/components/math/MathExpression";
import { captureEvent } from "@/lib/analytics/posthog";

// A plot of the displayed function, projected isometrically for the introduction.
function SurfacePreview() {
  const project = (x: number, y: number) => `${(260 + (x - y) * 28).toFixed(2)},${(145 + (x + y) * 12 - Math.sin(x) * Math.cos(y) * 48).toFixed(2)}`;
  const lines = Array.from({ length: 23 }, (_, index) => -Math.PI + index * Math.PI / 11);
  return <figure className="public-plot">
    <div className="public-plot-title"><span>Explore a surface</span><MathExpression expression="z = sin(x)*cos(y)" /></div>
    <svg viewBox="0 0 520 300" role="img" aria-label="Wireframe plot of z equals sine x times cosine y">
      {lines.map((fixed, index) => <g key={index}>
        <polyline points={lines.map((t) => project(fixed, t)).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="1.4" opacity="0.7" />
        <polyline points={lines.map((t) => project(t, fixed)).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="1.4" opacity="0.7" />
      </g>)}
    </svg>
    <figcaption>Change an expression. See its shape. Explore what it means.</figcaption>
  </figure>;
}

export default function LandingPage() {
  useEffect(() => { captureEvent("landing_viewed"); }, []);
  return <PublicPageShell>
    <section className="public-hero public-container">
      <div><p className="public-eyebrow">2D & 3D mathematics</p><h1>Make sense of math.<br />See it take shape.</h1>
        <p className="public-lead">Graph expressions, explore vector fields, and work through calculus in one visual workspace.</p>
        <div className="public-cta"><Link href="/editor" className="public-button public-button-primary" onClick={() => captureEvent("landing_open_editor_clicked")}>Start graphing</Link><Link href="/examples" className="public-button public-button-secondary" onClick={() => captureEvent("landing_open_examples_clicked")}>Try an example</Link></div>
        <p className="public-note">No account needed. Save projects in your browser.</p>
      </div><SurfacePreview />
    </section>
    <section className="public-container public-features" aria-labelledby="features-title">
      <div><p className="public-eyebrow">From expression to understanding</p><h2 id="features-title">Build, explore, solve.</h2><p>Start with a graph or a question. Keep the mathematics and its visualization together.</p><Link href="/documentations" className="public-text-link" onClick={() => captureEvent("landing_open_documentation_clicked")}>Learn your way around →</Link></div>
      <dl><div><dt>Graph in 2D and 3D</dt><dd>Plot explicit, implicit, and parametric surfaces, curves, vectors, and geometric objects.</dd></div><div><dt>Explore a selected object</dt><dd>Use Analyze for gradients, tangents, divergence, curl, and measurements. Pick points directly on the graph.</dd></div><div><dt>Follow the solution</dt><dd>Use Solve for scalar, vector, polar, and complex fields. Open the worked solution when you need the steps.</dd></div><div><dt>Keep and share your work</dt><dd>Save locally, share a scene link, or export JSON and images from the editor.</dd></div></dl>
    </section>
    <section className="public-container public-start" aria-labelledby="start-title"><h2 id="start-title">Your first graph in three steps</h2><ol><li><strong>Open the editor</strong><p>Choose Math Lab for functions and fields, or Geometry Studio for geometric objects.</p></li><li><strong>Add an object</strong><p>Use + Add, search for its type, and enter your expression in the definition.</p></li><li><strong>Explore it</strong><p>Select the object and open Analyze. Switch between 2D and 3D to find the view you need.</p></li></ol><Link href="/documentations#getting-started" className="public-text-link">Read the getting started guide →</Link></section>
  </PublicPageShell>;
}
