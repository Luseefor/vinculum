"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import type { MathfieldElement } from "mathlive";
import { expressionToLatex, normalizeMathInput, placeholderToLatex } from "@/lib/math/mathNotation";
import { useEditorStore } from "@/lib/store/editorStore";
import { getEquationParameterNames } from "@/lib/store/editorParameters";
import { MathExpression } from "./MathExpression";
import { cn } from "@/components/ui/styles";
import { getFocusableWithin } from "@/lib/a11y/useDialogFocusTrap";

type Props = InputHTMLAttributes<HTMLInputElement>;

/** One editing boundary: typeset math in browsers, native source entry as a recoverable fallback. */
export const MathInput = forwardRef<HTMLInputElement, Props>(function MathInput(props, forwardedRef) {
  const { value = "", onChange, className, ...nativeProps } = props;
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const mathRef = useRef<MathfieldElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const lastEmitted = useRef<string | null>(null);
  const transferFocus = useRef(false);
  const [ready, setReady] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const ariaLabel = props["aria-label"];
  const ariaInvalid = props["aria-invalid"];
  const ariaDescribedBy = props["aria-describedby"];
  const placeholder = props.placeholder;
  const readOnly = props.readOnly;
  const disabled = props.disabled;
  const sourceModeRef = useRef(sourceMode);
  sourceModeRef.current = sourceMode;

  useImperativeHandle(forwardedRef, () => {
    const input = inputRef.current!;
    return new Proxy(input, {
      get(target, property) {
        if (property === "focus") return (options?: FocusOptions) => {
          if (!sourceModeRef.current && mathRef.current && !hostRef.current?.hidden) {
            // MathLive defers focus and cancels it if the old input blurs
            // during that delay. Settle the native blur before requesting it.
            if (document.activeElement === target) target.blur();
            mathRef.current.focus();
          }
          else {
            target.focus(options);
            // Imports may resolve before React reveals the custom element.
            // Keep focus on the visible fallback and transfer after commit.
            if (!sourceModeRef.current && document.activeElement === target) transferFocus.current = true;
          }
        };
        if (property === "select") return () => !sourceModeRef.current && mathRef.current && !hostRef.current?.hidden ? mathRef.current.executeCommand("selectAll") : target.select();
        if (property === "blur") return () => !sourceModeRef.current && mathRef.current && !hostRef.current?.hidden ? mathRef.current.blur() : target.blur();
        const result = Reflect.get(target, property, target);
        return typeof result === "function" ? result.bind(target) : result;
      }
    });
  }, []);

  useEffect(() => {
    // Keep native editing available when custom-element/style APIs are unsupported.
    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return;
    let disposed = false;
    let field: MathfieldElement | null = null;
    const cleanups: Array<() => void> = [];
    Promise.all([import("mathlive"), import("@/lib/math/mathInputConversion")]).then(([{ MathfieldElement }, { latexToExpression }]) => {
      if (disposed || !hostRef.current) return;
      MathfieldElement.fontsDirectory = "/mathlive/fonts";
      MathfieldElement.soundsDirectory = null;
      field = new MathfieldElement();
      mathRef.current = field;
      field.mathVirtualKeyboardPolicy = "manual";
      if (propsRef.current.id) field.id = propsRef.current.id;
      field.smartFence = true;
      field.smartSuperscript = false;
      field.setValue(expressionToLatex(String(propsRef.current.value ?? "")) ?? String(propsRef.current.value ?? ""), { silenceNotifications: true });
      hostRef.current.appendChild(field);
      const listen = (name: string, callback: EventListener, capture = false) => {
        const target = name === "keydown" && capture ? field!.shadowRoot ?? field! : field!;
        target.addEventListener(name, callback, capture);
        cleanups.push(() => target.removeEventListener(name, callback, capture));
      };
      listen("keydown", (event) => {
        const key = event as KeyboardEvent;
        if (key.key === "Tab" && !key.ctrlKey && !key.metaKey && !key.altKey) {
          // MathLive includes its shadow keyboard controls in Tab navigation.
          // Keep the editor's visible fields and buttons in normal DOM order.
          const dialog = field!.closest<HTMLElement>('[role="dialog"]');
          const scope = dialog ?? document.body;
          const items = getFocusableWithin(scope);
          const index = items.indexOf(field!);
          const nextIndex = index + (key.shiftKey ? -1 : 1);
          const target = items[nextIndex] ?? (dialog ? items[key.shiftKey ? items.length - 1 : 0] : null);
          if (index >= 0 && target) {
            event.preventDefault();
            event.stopImmediatePropagation();
            target.focus();
          }
        } else if ((key.ctrlKey || key.metaKey) && key.key.toLowerCase() === "a") {
          event.preventDefault();
          event.stopImmediatePropagation();
          field!.executeCommand("selectAll");
        } else if (key.key === "(" && /\\(?:sin|cos|tan|sec|csc|cot|sinh|cosh|tanh)\^(?:\{[-\d.]+\}|[-\d.]+)$/.test(field!.value)) {
          // Function powers keep their argument outside the superscript: cos²(x).
          field!.executeCommand("moveAfterParent");
        }
      }, true);
      listen("input", () => {
        if (!field || !inputRef.current) return;
        const next = latexToExpression(field.value) ?? normalizeMathInput(field.getValue("ascii-math"));
        useEditorStore.getState().ensureParameters(getEquationParameterNames(next));
        lastEmitted.current = next;
        inputRef.current.value = next;
        propsRef.current.onChange?.({ target: inputRef.current, currentTarget: inputRef.current } as ChangeEvent<HTMLInputElement>);
      });
      listen("paste", (event) => {
        const text = (event as ClipboardEvent).clipboardData?.getData("text/plain");
        if (!text || text.includes("\\")) return;
        const tex = expressionToLatex(text);
        if (tex) { event.preventDefault(); event.stopImmediatePropagation(); field!.insert(tex); }
      }, true);
      listen("focus", (event) => propsRef.current.onFocus?.(event as unknown as React.FocusEvent<HTMLInputElement>));
      listen("blur", (event) => propsRef.current.onBlur?.(event as unknown as React.FocusEvent<HTMLInputElement>));
      listen("keydown", (event) => {
        // Existing React handlers rely on nativeEvent and currentTarget.blur().
        const adapted = new Proxy(event, {
          get(target, property) {
            if (property === "nativeEvent") return target;
            if (property === "currentTarget" || property === "target") return field;
            const result = Reflect.get(target, property, target);
            return typeof result === "function" ? result.bind(target) : result;
          }
        });
        propsRef.current.onKeyDown?.(adapted as unknown as React.KeyboardEvent<HTMLInputElement>);
        if ((event as KeyboardEvent).key === "Escape") {
          // MathLive otherwise consumes Escape and restores its caret after blur.
          event.preventDefault();
          event.stopImmediatePropagation();
          field!.blur();
          // Let the existing dialog/sheet dismissal handlers receive Escape.
          if (field!.closest('[role="dialog"]')) hostRef.current?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
        }
      }, true);
      // The host is still hidden until React commits `ready`. Focusing it
      // here loses focus when the native fallback is hidden in that commit.
      transferFocus.current ||= document.activeElement === inputRef.current;
      setReady(true);
    }).catch((error: unknown) => { console.warn("Math editor could not load; source editing remains available.", error); });
    return () => { disposed = true; cleanups.forEach((cleanup) => cleanup()); field?.remove(); mathRef.current = null; };
  }, []);

  useEffect(() => {
    const field = mathRef.current;
    if (!field) return;
    const label = ariaLabel ?? inputRef.current?.labels?.[0]?.textContent ?? "Expression";
    if (sourceMode) field.removeAttribute("aria-label");
    else field.setAttribute("aria-label", label);

    field.setAttribute("aria-invalid", String(ariaInvalid ?? false));
    if (ariaDescribedBy) field.setAttribute("aria-describedby", ariaDescribedBy);
    else field.removeAttribute("aria-describedby");
    // Hints live outside MathLive so select-all never highlights placeholder text.
    field.removeAttribute("placeholder");
    field.readOnly = Boolean(readOnly || disabled);
    field.tabIndex = disabled || sourceMode ? -1 : 0;
    if (String(value) !== lastEmitted.current) field.setValue(expressionToLatex(String(value)) ?? String(value), { silenceNotifications: true });
    lastEmitted.current = String(value);
  }, [value, ready, sourceMode, ariaLabel, ariaInvalid, ariaDescribedBy, placeholder, readOnly, disabled]);

  useEffect(() => {
    if (!ready || !transferFocus.current) return;
    transferFocus.current = false;
    // Let the browser finish hiding/blurring the fallback and lay out the
    // custom field before focusing its shadow keyboard sink.
    const frame = requestAnimationFrame(() => {
      if (!sourceMode && (document.activeElement === document.body || document.activeElement === inputRef.current)) {
        if (document.activeElement === inputRef.current) inputRef.current?.blur();
        mathRef.current?.focus();
        mathRef.current?.executeCommand("selectAll");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, sourceMode]);

  const label = props["aria-label"] ?? "expression";
  return <div data-math-input-id={inputId} className={cn("math-input min-w-0 flex-1", className)}>
    <div ref={hostRef} hidden={!ready || sourceMode} />
    {ready && !sourceMode && placeholder && !String(value).trim() ? <span aria-hidden="true" className="math-input-placeholder"><MathExpression expression={placeholder} latex={placeholderToLatex(placeholder)} /></span> : null}
    <input {...nativeProps} id={ready && props.id ? `${props.id}-source` : props.id} ref={inputRef} value={value} hidden={ready && !sourceMode} aria-label={ready && !sourceMode ? undefined : props["aria-label"]} aria-hidden={ready && !sourceMode ? true : undefined} spellCheck={false}
      className="math-source-input w-full min-w-0 bg-transparent outline-none" onChange={(event) => {
        const next = normalizeMathInput(event.target.value);
        if (next !== event.target.value) event.target.value = next;
        useEditorStore.getState().ensureParameters(getEquationParameterNames(next));
        onChange?.(event);
      }} />
    {ready ? <button type="button" disabled={disabled} title={sourceMode ? "Use typeset math editing" : "Edit as plain text"} className="math-source-toggle" aria-label={`${sourceMode ? "Use math editor for" : "Edit as text:"} ${label}`} aria-pressed={sourceMode} onClick={() => {
      setSourceMode(!sourceMode);
      requestAnimationFrame(() => {
        if (sourceMode) {
          if (document.activeElement === inputRef.current) inputRef.current?.blur();
          mathRef.current?.focus();
        } else {
          mathRef.current?.blur();
          inputRef.current?.focus();
        }
      });
    }}>{sourceMode ? "Math" : "Text"}</button> : null}
  </div>;
});
