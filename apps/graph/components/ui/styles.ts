export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export const ui = {
  panel: "rounded-md border border-slate-800/90 bg-slate-900/60",
  panelMuted: "rounded-md border border-slate-800/70 bg-slate-900/35",
  panelInteractive: "rounded-md border border-slate-800/90 bg-slate-900/65 transition-colors hover:border-slate-700/90",
  sectionTitle: "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400",
  fieldLabel: "mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500",
  fieldLabelCompact: "text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500",
  helperText: "text-[11px] leading-relaxed text-slate-500",
  inputBase:
    "w-full rounded-md border border-slate-700/90 bg-slate-950/95 px-2.5 py-1.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/20",
  inputMono:
    "w-full rounded-md border border-slate-700/90 bg-slate-950/95 px-2.5 py-1.5 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/20",
  inputMonoCompact:
    "w-full rounded-md border border-slate-700/90 bg-slate-950/95 px-2 py-1 font-mono text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/20",
  selectBase:
    "rounded-md border border-slate-700/90 bg-slate-950/95 px-2 py-1 text-xs font-medium text-slate-200 outline-none transition focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/20",
  buttonBase:
    "rounded-md border border-slate-700/90 bg-slate-900/90 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition focus:outline-none focus:ring-2 focus:ring-sky-500/25",
  buttonSubtle: "hover:border-slate-600/90 hover:bg-slate-800/80",
  buttonDanger: "hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-200",
  buttonPrimary:
    "border-sky-600/60 bg-sky-600/20 text-sky-100 hover:border-sky-500 hover:bg-sky-500/25",
  badge: "rounded-md border border-slate-800/90 bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-slate-400",
  tinyControl:
    "rounded border border-slate-700/90 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 transition hover:border-slate-600/90 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/25",
  colorInput:
    "h-6 w-6 cursor-pointer rounded-md border border-slate-700/90 bg-transparent p-0 shadow-[inset_0_0_0_1px_rgba(2,6,23,0.5)]",
  textarea:
    "h-[360px] w-full resize-none rounded-md border border-slate-800 bg-slate-900/60 p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none transition focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/20"
} as const;
