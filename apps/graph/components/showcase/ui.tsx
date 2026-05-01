"use client";

import { cn } from "@/components/ui/styles";
import type { ReactNode } from "react";

interface BaseProps {
  className?: string;
  children?: ReactNode;
}

export function Panel({ className, children }: BaseProps) {
  return <section className={cn("v-panel", className)}>{children}</section>;
}

interface ButtonProps extends BaseProps {
  type?: "button" | "submit" | "reset";
  active?: boolean;
  onClick?: () => void;
  title?: string;
  ariaPressed?: boolean;
  ariaLabel?: string;
}

export function Button({
  className,
  children,
  type = "button",
  active = false,
  onClick,
  title,
  ariaPressed,
  ariaLabel
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      aria-pressed={ariaPressed}
      aria-label={ariaLabel}
      className={cn("v-btn", active && "v-btn-active", className)}
    >
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonProps {
  icon: ReactNode;
}

export function IconButton({ className, icon, children, ...props }: IconButtonProps) {
  return (
    <Button className={cn("v-icon-btn", className)} {...props}>
      {icon}
      {children}
    </Button>
  );
}

interface ToggleItem {
  id: string;
  label: string;
}

interface ToggleGroupProps extends BaseProps {
  items: ToggleItem[];
  activeId: string;
  onChange: (id: string) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}

export function ToggleGroup({
  className,
  items,
  activeId,
  onChange,
  size = "md",
  ariaLabel
}: ToggleGroupProps) {
  return (
    <div className={cn("v-toggle-group", size === "sm" ? "v-toggle-group-sm" : "", className)} role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <Button
          key={item.id}
          className="v-toggle-item"
          active={activeId === item.id}
          ariaPressed={activeId === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}

interface TabsProps extends BaseProps {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ className, tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className={cn("v-tabs", className)} role="tablist" aria-label="Tabs">
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          className="v-tab"
          active={activeTab === tab.id}
          ariaPressed={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}

export function Badge({ className, children }: BaseProps) {
  return <span className={cn("v-badge", className)}>{children}</span>;
}

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  label?: ReactNode;
  ariaLabel?: string;
}

export function Switch({ checked, onCheckedChange, className, label, ariaLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={cn("v-switch", checked && "v-switch-on", className)}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="v-switch-thumb" />
      {label ? <span className="v-switch-label">{label}</span> : null}
    </button>
  );
}

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
}

export function Slider({ value, min, max, step = 0.1, onChange, className }: SliderProps) {
  return (
    <input
      className={cn("v-slider", className)}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

interface SwatchButtonProps {
  color: string;
  active?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}

export function SwatchButton({ color, active = false, onClick, ariaLabel, className }: SwatchButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn("v-swatch", active && "v-swatch-active", className)}
      style={{ backgroundColor: color }}
      onClick={onClick}
    />
  );
}

interface ThemePreviewCardProps {
  mode: "light" | "dark";
  active?: boolean;
  onClick?: () => void;
}

export function ThemePreviewCard({ mode, active = false, onClick }: ThemePreviewCardProps) {
  return (
    <button type="button" className={cn("theme-preview", active && "theme-preview-active")} onClick={onClick}>
      <span className={cn("theme-preview-surface", mode === "light" ? "theme-preview-light" : "theme-preview-dark")}>
        <span className="theme-preview-toolbar" />
        <span className="theme-preview-grid">
          <span />
          <span />
          <span />
          <span />
        </span>
      </span>
      <span className="theme-preview-label">{mode === "light" ? "Light" : "Dark"}</span>
      {active ? <span className="theme-preview-check">✓</span> : null}
    </button>
  );
}

interface DividerHandleProps {
  className?: string;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick?: () => void;
}

export function DividerHandle({ className, onPointerDown, onDoubleClick }: DividerHandleProps) {
  return (
    <div
      className={cn("divider-handle", className)}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      role="separator"
      aria-label="Resize divider"
    >
      <span />
      <span />
      <span />
    </div>
  );
}
