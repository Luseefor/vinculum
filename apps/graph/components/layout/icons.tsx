"use client";

import type { ReactNode, SVGProps } from "react";

function SvgIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />;
}

export function VinculumMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="toolbar-v-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path d="M4.4 5.1 10.1 5 14 16.3 18.2 4.9h5.5l-7.5 18h-4.4L4.4 5.1Z" fill="url(#toolbar-v-mark)" />
    </svg>
  );
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="m4 6.5 4 3.5 4-3.5" />
    </SvgIcon>
  );
}

export function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <circle cx="8" cy="8" r="2.4" />
      <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M12.8 3.2l-1.3 1.3M4.5 11.5l-1.3 1.3" />
    </SvgIcon>
  );
}

export function SplitViewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M8 3v10" />
    </SvgIcon>
  );
}

export function SingleViewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    </SvgIcon>
  );
}

export function QuadViewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M8 2.5v11M2.5 8h11" />
    </SvgIcon>
  );
}

export function MoreHorizontalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <circle cx="4" cy="8" r="1.1" />
      <circle cx="8" cy="8" r="1.1" />
      <circle cx="12" cy="8" r="1.1" />
    </svg>
  );
}

export function CursorArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="m3 2 7.5 7-3.8 1L5.8 13 3 2Z" />
    </SvgIcon>
  );
}

export function ConnectorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M6.1 9.9 4.3 11.7a2.1 2.1 0 0 1-3-3l2.6-2.6a2.1 2.1 0 0 1 3 0" />
      <path d="m9.9 6.1 1.8-1.8a2.1 2.1 0 0 1 3 3l-2.6 2.6a2.1 2.1 0 0 1-3 0" />
      <path d="m5.9 10.1 4.2-4.2" />
    </SvgIcon>
  );
}

export function CubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="m8 2 4.8 2.8v5.8L8 13.4l-4.8-2.8V4.8L8 2Z" />
      <path d="M3.2 4.8 8 7.5l4.8-2.7M8 7.5v5.9" />
    </SvgIcon>
  );
}

export function NodesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="3" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
      <circle cx="8" cy="13" r="1.4" />
      <path d="M4.3 7 6.8 4.4m2.4 0 2.5 2.6m0 2-2.5 2.6m-2.4 0L4.3 9" />
    </SvgIcon>
  );
}

export function ChainLinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M6 5.4 4.3 7.1a2 2 0 0 0 2.8 2.8L8.8 8.2" />
      <path d="m10 10.6 1.7-1.7a2 2 0 0 0-2.8-2.8L7.2 7.8" />
    </SvgIcon>
  );
}

export function SlidersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
      <circle cx="5.5" cy="4" r="1.2" />
      <circle cx="10.5" cy="8" r="1.2" />
      <circle cx="7.5" cy="12" r="1.2" />
    </SvgIcon>
  );
}

export function GearIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.8v1.5M8 12.7v1.5M1.8 8h1.5M12.7 8h1.5M3.2 3.2l1 1M11.8 11.8l1 1M12.8 3.2l-1 1M4.2 11.8l-1 1" />
    </SvgIcon>
  );
}

export function HelpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M6.3 6a1.8 1.8 0 1 1 3.2 1c-.5.6-1.5 1-1.5 2.1" />
      <path d="M8 11.8h.01" />
    </SvgIcon>
  );
}

export function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M10.6 1.9a5.8 5.8 0 1 0 3.5 10.8A6.3 6.3 0 1 1 10.6 1.9Z" />
    </SvgIcon>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <circle cx="7" cy="7" r="3.7" />
      <path d="m10.1 10.1 3 3" />
    </SvgIcon>
  );
}

export function FilterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M2.5 3h11L9.2 7.4v4l-2.4-1.1v-2.9L2.5 3Z" />
    </SvgIcon>
  );
}

export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M1.5 8s2.2-3.6 6.5-3.6S14.5 8 14.5 8s-2.2 3.6-6.5 3.6S1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="1.7" />
    </SvgIcon>
  );
}

export function EyeOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M2 2 14 14" />
      <path d="M6.5 4.6A7.6 7.6 0 0 1 8 4.4c4.3 0 6.5 3.6 6.5 3.6a11.8 11.8 0 0 1-2.8 3.1" />
      <path d="M3.4 6.1A11.7 11.7 0 0 0 1.5 8s2.2 3.6 6.5 3.6c.5 0 1-.1 1.5-.2" />
    </SvgIcon>
  );
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <rect x="3.4" y="7" width="9.2" height="5.8" rx="1.3" />
      <path d="M5.2 7V5.8a2.8 2.8 0 0 1 5.6 0V7" />
    </SvgIcon>
  );
}

export function OrbitAtomIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" {...props}>
      <circle cx="20" cy="20" r="2.8" fill="#6366f1" />
      <ellipse cx="20" cy="20" rx="12.8" ry="5.9" stroke="#6366f1" strokeWidth="2" />
      <ellipse cx="20" cy="20" rx="12.8" ry="5.9" transform="rotate(60 20 20)" stroke="#7c3aed" strokeWidth="2" />
      <ellipse cx="20" cy="20" rx="12.8" ry="5.9" transform="rotate(-60 20 20)" stroke="#8b5cf6" strokeWidth="2" />
    </svg>
  );
}

export function UndoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

export function RedoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
    </svg>
  );
}

export function RailIcon({ id, className }: { id: string; className?: string }) {
  const map: Record<string, ReactNode> = {
    select: <CursorArrowIcon className={className} />,
    connector: <ConnectorIcon className={className} />,
    cube: <CubeIcon className={className} />,
    nodes: <NodesIcon className={className} />,
    chain: <ChainLinkIcon className={className} />,
    sliders: <SlidersIcon className={className} />,
    gear: <GearIcon className={className} />,
    help: <HelpIcon className={className} />,
    moon: <MoonIcon className={className} />
  };
  return map[id] ?? <CursorArrowIcon className={className} />;
}
