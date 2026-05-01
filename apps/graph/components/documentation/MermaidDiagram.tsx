"use client";

import { useEffect, useRef, useState } from "react";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";

interface MermaidDiagramProps {
  title: string;
  code: string;
}

export default function MermaidDiagram({ title, code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const theme = useResolvedTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;
    
    let isCancelled = false;

    const renderDiagram = async () => {
      try {
        setHasError(false);
        const mermaid = (await import("mermaid")).default;
        
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === "dark" ? "dark" : "default",
          securityLevel: "loose",
        });

        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
        const { svg } = await mermaid.render(id, code);

        if (!isCancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (error) {
        console.error("Mermaid rendering error:", error);
        if (!isCancelled) {
          setHasError(true);
        }
      }
    };

    renderDiagram();

    return () => {
      isCancelled = true;
    };
  }, [code, theme, mounted]);

  return (
    <section className="my-8 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] shadow-sm">
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>
      <div className="relative w-full overflow-x-auto p-4 md:p-6">
        {(!mounted || hasError) ? (
          <pre className="overflow-x-auto rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 font-mono text-[12px] text-[var(--text-secondary)]">
            <code>{code}</code>
          </pre>
        ) : (
          <div className="flex min-h-[100px] min-w-[300px] items-center justify-center">
            <div ref={containerRef} className="mermaid-render-container w-full" />
          </div>
        )}
      </div>
    </section>
  );
}
