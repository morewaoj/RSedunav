import * as React from "react";

type StyleValue = string | number | null | undefined;

export type AppliedStyle = Record<string, StyleValue>;

function toCssPropertyName(key: string): string {
  // CSS custom properties (`--foo`) are already in CSS form and must be
  // passed through unchanged so `setProperty` can read them.
  if (key.startsWith("--")) return key;
  // Vendor-prefixed React style keys (e.g. `WebkitAppearance`) use a
  // capital first letter that maps to `-webkit-...`.
  let css = key.replace(/^([A-Z])/, (m) => `-${m.toLowerCase()}`);
  css = css.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  return css;
}

/**
 * Apply a style object to an element using the CSSOM
 * (`element.style.setProperty`) instead of the inline `style="..."` HTML
 * attribute. The CSSOM path is not subject to the CSP `style-src`
 * `'unsafe-inline'` restriction, which lets the app keep a strict CSP
 * while still applying dynamic style values (transforms, widths,
 * colors, CSS custom properties, etc.).
 *
 * Style keys may use the same camelCase form as React's `style` prop
 * (e.g. `backgroundColor`); they are converted to their CSS form
 * (`background-color`) before being handed to `setProperty`. Keys that
 * are already CSS custom properties (start with `--`) are passed
 * through unchanged.
 *
 * Returns a callback ref that should be attached to the target element.
 * Optionally forwards the same node to an external ref (for
 * components built with `React.forwardRef`).
 */
export function useAppliedStyle<T extends HTMLElement>(
  style: AppliedStyle | undefined,
  forwardedRef?: React.Ref<T> | null,
): React.RefCallback<T> {
  const internalRef = React.useRef<T | null>(null);
  const styleRef = React.useRef<AppliedStyle | undefined>(style);
  styleRef.current = style;
  // Track which CSS property names are currently applied so we can
  // clear stale ones when a key is removed between renders.
  const appliedKeysRef = React.useRef<Set<string>>(new Set());

  const serialized = style ? JSON.stringify(style) : "";

  const applyStyle = React.useCallback((el: T | null) => {
    if (!el) return;
    const next = styleRef.current ?? {};
    const nextKeys = new Set<string>();
    for (const [key, value] of Object.entries(next)) {
      const cssKey = toCssPropertyName(key);
      if (value == null || value === "") {
        el.style.removeProperty(cssKey);
      } else {
        el.style.setProperty(cssKey, String(value));
        nextKeys.add(cssKey);
      }
    }
    // Remove any properties that were set previously but are no
    // longer present in the current style object.
    for (const prevKey of appliedKeysRef.current) {
      if (!nextKeys.has(prevKey)) {
        el.style.removeProperty(prevKey);
      }
    }
    appliedKeysRef.current = nextKeys;
  }, []);

  React.useLayoutEffect(() => {
    applyStyle(internalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  return React.useCallback(
    (node: T | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef && typeof forwardedRef === "object") {
        (forwardedRef as React.MutableRefObject<T | null>).current = node;
      }
      applyStyle(node);
    },
    [forwardedRef, applyStyle],
  );
}
