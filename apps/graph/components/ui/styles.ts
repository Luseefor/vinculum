export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export const ui = {
  // Panels
  panel: "panel",
  panelInset: "panel-inset",
  
  // Typography
  sectionTitle: "text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]",
  fieldLabel: "mb-1.5 block text-[11px] font-medium text-[var(--text-secondary)]",
  fieldLabelCompact: "text-[10px] font-medium text-[var(--text-secondary)]",
  helperText: "text-[11px] leading-relaxed text-[var(--text-tertiary)]",
  
  // Inputs
  inputBase: "input",
  inputMono: "input",
  inputMonoCompact: "input text-xs py-1.5 px-2",
  selectBase: "input py-1.5 px-2 text-xs cursor-pointer",
  
  // Buttons
  buttonBase: "btn",
  buttonSubtle: "",
  buttonDanger: "hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400",
  buttonPrimary: "btn-primary",
  
  // Misc
  badge: "px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] bg-black/20 rounded-md",
  tinyControl: "btn text-[10px] px-2 py-0.5 uppercase tracking-wide",
  colorInput: "color-swatch",
  textarea: "input h-[360px] resize-none font-mono text-xs leading-relaxed"
} as const;
