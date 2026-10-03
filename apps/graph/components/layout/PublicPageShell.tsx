"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import ThemeSync from "@/components/theme/ThemeSync";
import { MoonIcon, SunIcon, VinculumMark } from "@/components/layout/icons";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { useGraphStore } from "@/store/graphStore";

export default function PublicPageShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const theme = useResolvedTheme();
  const setThemeMode = useGraphStore((state) => state.setThemeMode);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <div className="public-site">
    <ThemeSync />
    <a className="public-skip" href="#page-content">Skip to content</a>
    <header className="public-header">
      <div className="public-header-inner">
        <Link href="/" className="public-brand" aria-label="Vinculum home"><VinculumMark className="h-6 w-6" />Vinculum</Link>
        <div className="public-header-actions">
          <button type="button" className="public-theme" aria-label={mounted && theme === "dark" ? "Use light theme" : "Use dark theme"}
            onClick={() => setThemeMode(theme === "dark" ? "light" : "dark")}>
            {mounted && theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
          </button>
          <Link href="/editor" className="public-button public-button-primary">Open editor</Link>
        </div>
        <nav aria-label="Primary" className="public-nav">
          <Link href="/" aria-current={path === "/" ? "page" : undefined}>Overview</Link>
          <Link href="/examples">Examples</Link>
          <Link href="/documentations" aria-current={path === "/documentations" ? "page" : undefined}>Guide</Link>
        </nav>
      </div>
    </header>
    <main id="page-content" tabIndex={-1}>{children}</main>
    <footer className="public-footer"><span>Vinculum · A workspace for mathematics</span><nav aria-label="Footer"><Link href="/editor">Editor</Link><Link href="/examples">Examples</Link><Link href="/documentations">Guide</Link></nav></footer>
  </div>;
}
