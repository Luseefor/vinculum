"use client";

import type { ReactNode, SVGProps } from "react";

function SvgIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />;
}

export function VinculumMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" {...props}>
      <path d="M2.4 4.6h3.7l5.6 9.6H8.4Z" fill="currentColor" />
      <path d="M25.6 4.6h-3.7l-5.6 9.6h3.3Z" fill="#f26b1d" />
      <path d="M13.3 16.1H9.8a2.75 2.75 0 0 0 0 5.5h3.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M14.7 16.1h3.5a2.75 2.75 0 0 1 0 5.5h-3.5" fill="none" stroke="#f26b1d" strokeWidth="1.9" />
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

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M8 3.5v9M3.5 8h9" />
    </SvgIcon>
  );
}

export function ShareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M8 2.5v7.5M5.2 5.2 8 2.5l2.8 2.7" />
      <path d="M4.5 8H3.8a.8.8 0 0 0-.8.8v4a.8.8 0 0 0 .8.8h8.4a.8.8 0 0 0 .8-.8v-4a.8.8 0 0 0-.8-.8h-.7" />
    </SvgIcon>
  );
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M8 2.5v7.5M5.2 7.3 8 10l2.8-2.7" />
      <path d="M3 11v1.7a.8.8 0 0 0 .8.8h8.4a.8.8 0 0 0 .8-.8V11" />
    </SvgIcon>
  );
}

export function GridIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <rect x="2.75" y="2.75" width="4" height="4" rx="1" />
      <rect x="9.25" y="2.75" width="4" height="4" rx="1" />
      <rect x="2.75" y="9.25" width="4" height="4" rx="1" />
      <rect x="9.25" y="9.25" width="4" height="4" rx="1" />
    </SvgIcon>
  );
}

export function FocusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M2.75 5.5V3.6a.85.85 0 0 1 .85-.85H5.5M10.5 2.75h1.9a.85.85 0 0 1 .85.85V5.5M13.25 10.5v1.9a.85.85 0 0 1-.85.85H10.5M5.5 13.25H3.6a.85.85 0 0 1-.85-.85V10.5" />
      <circle cx="8" cy="8" r="1.6" />
    </SvgIcon>
  );
}

export function ExpandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M9.5 2.75h3.75V6.5M13.25 2.75 9.25 6.75M6.5 13.25H2.75V9.5M2.75 13.25l4-4" />
    </SvgIcon>
  );
}

export function PanelRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.75" />
      <path d="M10 2.75v10.5" />
    </SvgIcon>
  );
}

export function PanelBottomIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.75" />
      <path d="M2.25 10h11.5" />
    </SvgIcon>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </SvgIcon>
  );
}

export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgIcon {...props}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </SvgIcon>
  );
}
