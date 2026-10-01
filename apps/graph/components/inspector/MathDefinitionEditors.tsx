// S32 Math Lab expression-first definition editors.
//
// The Object tab must lead with the mathematics: the equation/expression is
// the dominant control, domain is discoverable but subordinate, and sampling
// is progressively disclosed. These editors commit expressions per keystroke
// to the canonical scene (established S30 draft discipline), so Object↔
// Analyze tab switches and worker completions never destroy typing state —
// the draft IS the canonical value, including invalid intermediates.
//
// No math semantics change here: every commit funnels through the existing
// graphStore update actions only.

"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ImplicitSurfaceObject,
  ParametricCurveObject,
  ParametricSurfaceObject,
  SurfaceGraphObject,
  VectorFieldObject
} from "@vinculum/scene/types";
import type { SurfaceOrientation } from "@vinculum/scene/types";
import { Input } from "@/components/ui/input";
import { StatusCallout } from "@/components/ui/StatusCallout";
import { useGraphStore } from "@/store/graphStore";
import {
  getImplicitSurfaceEquationDiagnostics,
  getParametricAxisDiagnostics,
  getParametricSurfaceAxisDiagnostics,
  getSurfaceEquationDiagnostics,
  getVectorFieldComponentDiagnostics
} from "@/lib/math/expressionDiagnostics";

function useCommittedText(committed: string, active: boolean): [string, (next: string) => void] {
  const [draft, setDraft] = useState(committed);
  useEffect(() => {
    if (!active) {
      setDraft(committed);
    }
  }, [committed, active]);
  return [active ? draft : committed, setDraft];
}

function DiagnosticNote({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <StatusCallout tone="error" testId="math-definition-diagnostic" role="status">
      {message}
    </StatusCallout>
  );
}

function firstError(messages: Array<string | null>): string | null {
  return messages.find((message) => message !== null) ?? null;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h4 className="mb-1.5 text-[11px] font-medium text-[var(--text-tertiary)]">
      {children}
    </h4>
  );
}

function DefinitionShell({
  children
}: {
  title: string;
  badge: string;
  blurb: string;
  children: React.ReactNode;
}) {
  // Title, kind badge, and prose live in the Inspector identity header; the
  // definition section leads directly with the mathematics.
  return (
    <section className="border-b border-[var(--border-subtle)] pb-4 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function ExpressionInput({
  prefix,
  committed,
  ariaLabel,
  placeholder,
  invalid,
  describedBy,
  onCommit,
}: {
  prefix: string;
  committed: string;
  ariaLabel: string;
  placeholder: string;
  invalid: boolean;
  describedBy?: string;
  onCommit: (next: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useCommittedText(committed, focused);
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2 py-1.5 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] transition-colors">
      <span aria-hidden="true" className="shrink-0 font-mono text-[12px] font-semibold text-[var(--text-secondary)]">
        {prefix}
      </span>
      <input
        type="text"
        value={draft}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-describedby={invalid && describedBy ? describedBy : undefined}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onCommit(next);
        }}
        onFocus={() => {
          setDraft(committed);
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          if (draft !== committed) {
            onCommit(draft);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.currentTarget.blur();
          }
        }}
        className="w-full bg-transparent font-mono text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
      />
    </div>
  );
}

function CompactDomainGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function DomainNumberInput({
  label,
  value,
  onCommit
}: {
  label: string;
  value: number;
  onCommit: (next: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    if (!focused) {
      setDraft(String(value));
    }
  }, [value, focused]);
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
        {label}
      </span>
      <Input
        type="number"
        step="any"
        value={focused ? draft : String(value)}
        aria-label={label}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = Number(event.target.value);
          if (event.target.value.trim() !== "" && Number.isFinite(next)) {
            onCommit(next);
          }
        }}
        onFocus={() => {
          setDraft(String(value));
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          const next = Number(draft);
          if (draft.trim() === "" || !Number.isFinite(next)) {
            setDraft(String(value));
            return;
          }
          if (next !== value) {
            onCommit(next);
          }
        }}
        className="h-8 rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
      />
    </label>
  );
}

// --- Explicit surface: z = f(x,y) (orientation-aware) ---

const ORIENTATION_OPTIONS: Array<{ value: SurfaceOrientation; label: string; prefix: string }> = [
  { value: "z", label: "z = f(x,y)", prefix: "z =" },
  { value: "x", label: "x = f(y,z)", prefix: "x =" },
  { value: "y", label: "y = f(x,z)", prefix: "y =" }
];

export function SurfaceDefinitionEditor({
  object,
  index
}: {
  object: SurfaceGraphObject;
  index: number;
}) {
  const updateSurfaceEquation = useGraphStore((state) => state.updateSurfaceEquation);
  const updateSurfaceOrientation = useGraphStore((state) => state.updateSurfaceOrientation);
  const updateSurfaceDomain = useGraphStore((state) => state.updateSurfaceDomain);
  const orientation = object.orientation ?? "z";
  const active = useMemo(
    () => ORIENTATION_OPTIONS.find((entry) => entry.value === orientation) ?? ORIENTATION_OPTIONS[0]!,
    [orientation]
  );
  const diagnostic = useMemo(() => {
    if (!object.equation.trim()) {
      return null;
    }
    const diag = getSurfaceEquationDiagnostics(object.equation, orientation);
    return diag.status === "error"
      ? `${diag.message}${diag.suggestion ? ` ${diag.suggestion}` : ""}`
      : null;
  }, [object.equation, orientation]);

  return (
    <DefinitionShell
      title={`Surface${index >= 0 ? ` #${index + 1}` : ""}`}
      badge={active.label}
      blurb="Type the explicit function. Domain and sampling stay subordinate to the equation."
    >
      <div>
        <SectionLabel>Definition</SectionLabel>
        <ExpressionInput
          prefix={active.prefix}
          committed={object.equation}
          ariaLabel={`Surface expression ${active.label}`}
          placeholder="x^2 + y^2"
          invalid={diagnostic !== null}
          describedBy={`surface-${object.id}-diagnostic`}
          onCommit={(next) => updateSurfaceEquation(object.id, next)}
        />
        <label className="mt-2 block">
          <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
            Dependent variable
          </span>
          <select
            value={orientation}
            aria-label="Dependent variable"
            onChange={(event) => {
              const next = event.target.value;
              if (next === "x" || next === "y" || next === "z") {
                updateSurfaceOrientation(object.id, next);
              }
            }}
            className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2.5 text-[13px] text-[var(--text-primary)]"
          >
            {ORIENTATION_OPTIONS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        {diagnostic ? (
          <div id={`surface-${object.id}-diagnostic`} className="mt-2">
            <DiagnosticNote message={diagnostic} />
          </div>
        ) : null}
      </div>
      <div>
        <SectionLabel>Domain</SectionLabel>
        <CompactDomainGrid>
          <DomainNumberInput label="x min" value={object.domain.xMin} onCommit={(v) => updateSurfaceDomain(object.id, { xMin: v })} />
          <DomainNumberInput label="x max" value={object.domain.xMax} onCommit={(v) => updateSurfaceDomain(object.id, { xMax: v })} />
          <DomainNumberInput label="y min" value={object.domain.yMin} onCommit={(v) => updateSurfaceDomain(object.id, { yMin: v })} />
          <DomainNumberInput label="y max" value={object.domain.yMax} onCommit={(v) => updateSurfaceDomain(object.id, { yMax: v })} />
        </CompactDomainGrid>
      </div>
    </DefinitionShell>
  );
}

// --- Parametric curve: r(t) = <x(t), y(t), z(t)> ---

export function ParametricCurveDefinitionEditor({
  object,
  index
}: {
  object: ParametricCurveObject;
  index: number;
}) {
  const updateParametricExpression = useGraphStore((state) => state.updateParametricExpression);
  const diagnostic = useMemo(() => {
    const fields = [
      { field: "xExpr" as const, value: object.xExpr },
      { field: "yExpr" as const, value: object.yExpr },
      { field: "zExpr" as const, value: object.zExpr }
    ];
    for (const entry of fields) {
      if (!entry.value.trim()) {
        continue;
      }
      const diag = getParametricAxisDiagnostics({
        field: entry.field,
        xExpr: object.xExpr,
        yExpr: object.yExpr,
        zExpr: object.zExpr
      });
      if (diag.status === "error") {
        return `${diag.message}${diag.suggestion ? ` ${diag.suggestion}` : ""}`;
      }
    }
    return null;
  }, [object.xExpr, object.yExpr, object.zExpr]);

  const tuple = [
    { prefix: "x(t) =", field: "xExpr" as const, committed: object.xExpr, label: "Parametric x(t)", placeholder: "cos(t)" },
    { prefix: "y(t) =", field: "yExpr" as const, committed: object.yExpr, label: "Parametric y(t)", placeholder: "sin(t)" },
    { prefix: "z(t) =", field: "zExpr" as const, committed: object.zExpr, label: "Parametric z(t)", placeholder: "t" }
  ];

  return (
    <DefinitionShell
      title={`Parametric Curve${index >= 0 ? ` #${index + 1}` : ""}`}
      badge="r(t) = <x, y, z>"
      blurb="The three components belong together. Tab order is x(t) → y(t) → z(t) → t min → t max."
    >
      <div>
        <SectionLabel>Definition</SectionLabel>
        <div className="flex flex-col gap-1.5" role="group" aria-label="Parametric curve components r(t)">
          {tuple.map((entry) => (
            <ExpressionInput
              key={entry.field}
              prefix={entry.prefix}
              committed={entry.committed}
              ariaLabel={entry.label}
              placeholder={entry.placeholder}
              invalid={false}
              onCommit={(next) => updateParametricExpression(object.id, entry.field, next)}
            />
          ))}
        </div>
        {diagnostic ? <div className="mt-2"><DiagnosticNote message={diagnostic} /></div> : null}
      </div>
      <div>
        <SectionLabel>t domain</SectionLabel>
        <CompactDomainGrid>
          <DomainNumberInput label="t min" value={object.tMin} onCommit={(v) => updateParametricExpression(object.id, "tMin", v)} />
          <DomainNumberInput label="t max" value={object.tMax} onCommit={(v) => updateParametricExpression(object.id, "tMax", v)} />
        </CompactDomainGrid>
      </div>
      <details className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-2 py-1.5">
        <summary className="cursor-pointer text-[11px] font-semibold text-[var(--text-secondary)]">
          Sampling · {object.samples} samples
        </summary>
        <label className="mt-2 block">
          <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
            Samples
          </span>
          <Input
            type="number"
            min={2}
            value={object.samples}
            aria-label="Curve samples"
            onChange={(event) => {
              const v = Number(event.target.value);
              if (Number.isFinite(v)) {
                updateParametricExpression(object.id, "samples", v);
              }
            }}
            className="h-8 rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
          />
        </label>
      </details>
    </DefinitionShell>
  );
}

// --- Parametric surface: r(u,v) ---

export function ParametricSurfaceDefinitionEditor({
  object,
  index
}: {
  object: ParametricSurfaceObject;
  index: number;
}) {
  const updateParametricSurfaceExpression = useGraphStore((state) => state.updateParametricSurfaceExpression);
  const diagnostic = useMemo(() => {
    const fields = [
      { field: "xExpr" as const, value: object.xExpr },
      { field: "yExpr" as const, value: object.yExpr },
      { field: "zExpr" as const, value: object.zExpr }
    ];
    for (const entry of fields) {
      if (!entry.value.trim()) {
        continue;
      }
      const diag = getParametricSurfaceAxisDiagnostics({
        field: entry.field,
        xExpr: object.xExpr,
        yExpr: object.yExpr,
        zExpr: object.zExpr
      });
      if (diag.status === "error") {
        return `${diag.message}${diag.suggestion ? ` ${diag.suggestion}` : ""}`;
      }
    }
    return null;
  }, [object.xExpr, object.yExpr, object.zExpr]);

  const tuple = [
    { prefix: "x(u,v) =", field: "xExpr" as const, committed: object.xExpr, label: "Parametric surface x(u,v)", placeholder: "sin(u) * cos(v)" },
    { prefix: "y(u,v) =", field: "yExpr" as const, committed: object.yExpr, label: "Parametric surface y(u,v)", placeholder: "sin(u) * sin(v)" },
    { prefix: "z(u,v) =", field: "zExpr" as const, committed: object.zExpr, label: "Parametric surface z(u,v)", placeholder: "cos(u)" }
  ];

  return (
    <DefinitionShell
      title={`Parametric Surface${index >= 0 ? ` #${index + 1}` : ""}`}
      badge="r(u,v) = <x, y, z>"
      blurb="One vector-valued function of two parameters. Resolution stays subordinate."
    >
      <div>
        <SectionLabel>Definition</SectionLabel>
        <div className="flex flex-col gap-1.5" role="group" aria-label="Parametric surface components r(u,v)">
          {tuple.map((entry) => (
            <ExpressionInput
              key={entry.field}
              prefix={entry.prefix}
              committed={entry.committed}
              ariaLabel={entry.label}
              placeholder={entry.placeholder}
              invalid={false}
              onCommit={(next) => updateParametricSurfaceExpression(object.id, entry.field, next)}
            />
          ))}
        </div>
        {diagnostic ? <div className="mt-2"><DiagnosticNote message={diagnostic} /></div> : null}
      </div>
      <div>
        <SectionLabel>Parameter domains</SectionLabel>
        <CompactDomainGrid>
          <DomainNumberInput label="u min" value={object.domain.uMin} onCommit={(v) => updateParametricSurfaceExpression(object.id, "uMin", v)} />
          <DomainNumberInput label="u max" value={object.domain.uMax} onCommit={(v) => updateParametricSurfaceExpression(object.id, "uMax", v)} />
          <DomainNumberInput label="v min" value={object.domain.vMin} onCommit={(v) => updateParametricSurfaceExpression(object.id, "vMin", v)} />
          <DomainNumberInput label="v max" value={object.domain.vMax} onCommit={(v) => updateParametricSurfaceExpression(object.id, "vMax", v)} />
        </CompactDomainGrid>
      </div>
    </DefinitionShell>
  );
}

// --- Implicit surface: F(x,y,z) = 0 ---

export function ImplicitSurfaceDefinitionEditor({
  object,
  index
}: {
  object: ImplicitSurfaceObject;
  index: number;
}) {
  const updateImplicitSurfaceExpression = useGraphStore((state) => state.updateImplicitSurfaceExpression);
  const diagnostic = useMemo(() => {
    if (!object.equation.trim()) {
      return null;
    }
    const diag = getImplicitSurfaceEquationDiagnostics(object.equation);
    return diag.status === "error"
      ? `${diag.message}${diag.suggestion ? ` ${diag.suggestion}` : ""}`
      : null;
  }, [object.equation]);

  return (
    <DefinitionShell
      title={`Implicit Surface${index >= 0 ? ` #${index + 1}` : ""}`}
      badge="F(x,y,z) = 0"
      blurb="Type the equation naturally — bare fields and equalities both work."
    >
      <div>
        <SectionLabel>Definition</SectionLabel>
        <ExpressionInput
          prefix="F ="
          committed={object.equation}
          ariaLabel="Implicit surface equation F(x,y,z) = 0"
          placeholder="x^2 + y^2 + z^2 = 1"
          invalid={diagnostic !== null}
          describedBy={`implicit-${object.id}-diagnostic`}
          onCommit={(next) => updateImplicitSurfaceExpression(object.id, "equation", next)}
        />
        {diagnostic ? (
          <div id={`implicit-${object.id}-diagnostic`} className="mt-2">
            <DiagnosticNote message={diagnostic} />
          </div>
        ) : null}
      </div>
      <div>
        <SectionLabel>Sampling box</SectionLabel>
        <CompactDomainGrid>
          <DomainNumberInput label="x min" value={object.domain.xMin} onCommit={(v) => updateImplicitSurfaceExpression(object.id, "xMin", v)} />
          <DomainNumberInput label="x max" value={object.domain.xMax} onCommit={(v) => updateImplicitSurfaceExpression(object.id, "xMax", v)} />
          <DomainNumberInput label="y min" value={object.domain.yMin} onCommit={(v) => updateImplicitSurfaceExpression(object.id, "yMin", v)} />
          <DomainNumberInput label="y max" value={object.domain.yMax} onCommit={(v) => updateImplicitSurfaceExpression(object.id, "yMax", v)} />
          <DomainNumberInput label="z min" value={object.domain.zMin} onCommit={(v) => updateImplicitSurfaceExpression(object.id, "zMin", v)} />
          <DomainNumberInput label="z max" value={object.domain.zMax} onCommit={(v) => updateImplicitSurfaceExpression(object.id, "zMax", v)} />
        </CompactDomainGrid>
      </div>
    </DefinitionShell>
  );
}

// --- Vector field: F(x,y) = <P, Q> ---

export function VectorFieldDefinitionEditor({
  object,
  index
}: {
  object: VectorFieldObject;
  index: number;
}) {
  const updateVectorFieldExpression = useGraphStore((state) => state.updateVectorFieldExpression);
  const setObjectKind = useGraphStore((state) => state.setObjectKind);
  const is3D = object.dimension === "3d";
  const coords = is3D ? "x,y,z" : "x,y";
  const diagnostic = useMemo(() => {
    const fields = [
      { field: "pExpr" as const, value: object.pExpr },
      { field: "qExpr" as const, value: object.qExpr },
      ...(is3D ? [{ field: "rExpr" as const, value: object.rExpr }] : [])
    ];
    const messages: Array<string | null> = [];
    for (const entry of fields) {
      if (!entry.value.trim()) {
        messages.push(null);
        continue;
      }
      const diag = getVectorFieldComponentDiagnostics({
        field: entry.field,
        dimension: object.dimension,
        pExpr: object.pExpr,
        qExpr: object.qExpr,
        rExpr: object.rExpr
      });
      messages.push(diag.status === "error" ? `${diag.message}${diag.suggestion ? ` ${diag.suggestion}` : ""}` : null);
    }
    return firstError(messages);
  }, [object.pExpr, object.qExpr, object.rExpr, object.dimension, is3D]);

  const components = [
    { prefix: is3D ? "P(x,y,z) =" : "P(x,y) =", field: "pExpr" as const, committed: object.pExpr, label: "Vector field P component", placeholder: "-y" },
    { prefix: is3D ? "Q(x,y,z) =" : "Q(x,y) =", field: "qExpr" as const, committed: object.qExpr, label: "Vector field Q component", placeholder: "x" },
    ...(is3D
      ? [{ prefix: "R(x,y,z) =", field: "rExpr" as const, committed: object.rExpr, label: "Vector field R component", placeholder: "0" }]
      : [])
  ];

  return (
    <DefinitionShell
      title={`Vector Field${index >= 0 ? ` #${index + 1}` : ""}`}
      badge={`F(${coords}) = <${is3D ? "P, Q, R" : "P, Q"}>`}
      blurb={`One mathematical vector on a bounded grid. ${is3D ? "3D fields sample F(x,y,z)." : "2D fields sample F(x,y)."}`}
    >
      <div>
        <SectionLabel>Definition</SectionLabel>
        <div className="flex flex-col gap-1.5" role="group" aria-label={`Vector field components F(${coords})`}>
          {components.map((entry) => (
            <ExpressionInput
              key={entry.field}
              prefix={entry.prefix}
              committed={entry.committed}
              ariaLabel={entry.label}
              placeholder={entry.placeholder}
              invalid={false}
              onCommit={(next) => updateVectorFieldExpression(object.id, entry.field, next)}
            />
          ))}
        </div>
        {diagnostic ? <div className="mt-2"><DiagnosticNote message={diagnostic} /></div> : null}
        <label className="mt-2 block">
          <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
            Dimension
          </span>
          <select
            value={object.dimension}
            aria-label="Vector field dimension"
            onChange={(event) => {
              const next = event.target.value;
              if (next === "2d" || next === "3d") {
                setObjectKind(object.id, "vectorField", next);
              }
            }}
            className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2.5 text-[13px] text-[var(--text-primary)]"
          >
            <option value="2d">2D — F(x,y)</option>
            <option value="3d">3D — F(x,y,z)</option>
          </select>
        </label>
      </div>
      <div>
        <SectionLabel>Domain</SectionLabel>
        <CompactDomainGrid>
          <DomainNumberInput label="x min" value={object.domain.xMin} onCommit={(v) => updateVectorFieldExpression(object.id, "xMin", v)} />
          <DomainNumberInput label="x max" value={object.domain.xMax} onCommit={(v) => updateVectorFieldExpression(object.id, "xMax", v)} />
          <DomainNumberInput label="y min" value={object.domain.yMin} onCommit={(v) => updateVectorFieldExpression(object.id, "yMin", v)} />
          <DomainNumberInput label="y max" value={object.domain.yMax} onCommit={(v) => updateVectorFieldExpression(object.id, "yMax", v)} />
          {is3D ? (
            <>
              <DomainNumberInput
                label="z min"
                value={(object.domain as { zMin: number }).zMin}
                onCommit={(v) => updateVectorFieldExpression(object.id, "zMin", v)}
              />
              <DomainNumberInput
                label="z max"
                value={(object.domain as { zMax: number }).zMax}
                onCommit={(v) => updateVectorFieldExpression(object.id, "zMax", v)}
              />
            </>
          ) : null}
        </CompactDomainGrid>
      </div>
      <details className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-2 py-1.5">
        <summary className="cursor-pointer text-[11px] font-semibold text-[var(--text-secondary)]">
          Sampling · density {object.density}
        </summary>
        <label className="mt-2 block">
          <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
            Density per axis
          </span>
          <Input
            type="number"
            value={object.density}
            aria-label="Field density per axis"
            onChange={(event) => {
              const v = Number(event.target.value);
              if (Number.isFinite(v)) {
                updateVectorFieldExpression(object.id, "density", v);
              }
            }}
            className="h-8 rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
          />
        </label>
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-tertiary)]">
          Scale and normalize live in the Styles tab — presentation only, never resampling.
        </p>
      </details>
    </DefinitionShell>
  );
}
