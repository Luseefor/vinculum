"use client";

import { useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import katex from "katex";
import { expressionToLatex } from "@/lib/math/mathNotation";
import { cn } from "@/components/ui/styles";

interface MathExpressionProps extends HTMLAttributes<HTMLSpanElement> {
  expression: string;
  latex?: string;
  display?: boolean;
}

export function MathExpression({ expression, latex, display = false, className, ...props }: MathExpressionProps) {
  const html = useMemo(() => {
    const tex = latex ?? expressionToLatex(expression);
    if (!tex) return null;
    try { return katex.renderToString(tex, { throwOnError: true, trust: false, strict: "error", output: "html", displayMode: display, maxExpand: 1000 }); }
    catch { return null; }
  }, [expression, latex, display]);
  const elementRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const measure = () => setOverflowing(element.scrollWidth > element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // Font loading can change the formula width while its clipped container
    // stays the same size, so observe the rendered formula as well.
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [html]);
  return html ? <span ref={elementRef} tabIndex={display || overflowing ? 0 : undefined} {...props} role="math" aria-label={expression} className={cn("math-expression", className)} dangerouslySetInnerHTML={{ __html: html }} />
    : <span {...props} className={className}>{expression}</span>;
}

export function MathText({ text, className, ...props }: HTMLAttributes<HTMLSpanElement> & { text: string }) {
  const trimmed = text.trim();
  if (/^[A-Za-z]{3,}\s*\/\s*[A-Za-z]{3,}$/.test(trimmed)) return <span {...props} className={className}>{text}</span>;
  const candidate = /[0-9=<>^+*/∇Δ∂√πθ×−]/.test(text) || /^[A-Za-z]$/.test(trimmed);
  if (candidate && expressionToLatex(text)) return <MathExpression {...props} expression={text} className={className} />;
  // Worked explanations retain their prose while embedded definitions use the same renderer.
  const assignment = /(?:[∇Δ]?[A-Za-z][ₓᵧ₀]?|[A-Za-z][′']?\([^)]*\))\s*=\s*/g;
  const parts: ReactNode[] = [];
  let consumed = 0;
  for (const match of text.matchAll(assignment)) {
    const start = match.index!;
    if (start < consumed || (start > 0 && /[A-Za-z]/.test(text[start - 1]!))) continue;
    const rest = text.slice(start);
    const boundary = rest.search(/(?:,\s*(?:where|then)|\s+(?:on the|where|and|together)\b|\.\s+[A-Z])/);
    const end = boundary < 0 ? text.length : start + boundary;
    const expression = text.slice(start, end).replace(/\.$/, "");
    if (!expressionToLatex(expression)) continue;
    parts.push(text.slice(consumed, start), <MathExpression key={start} expression={expression} />);
    consumed = start + expression.length;
  }
  if (!parts.length) return <span {...props} className={className}>{text}</span>;
  parts.push(text.slice(consumed));
  return <span {...props} className={className}>{parts}</span>;
}
