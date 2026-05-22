import { Alert, Linking, Platform } from "react-native";

/**
 * Convert an object key into a human-readable label.
 * `academicLevel` -> "Academic Level"
 * `gpa_min`      -> "Gpa Min"
 */
export function formatKey(k: string): string {
  return k
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Convert any unknown server-supplied value into a safe string suitable for
 * rendering inside a React Native <Text> node. Never returns an object.
 *
 * - string / number / boolean → string
 * - array of primitives       → comma joined
 * - array of objects          → joined with " — "
 * - object                    → "Key: value\nKey: value"
 * - null / undefined / empty  → fallback (default "Not specified")
 */
export function formatValue(
  value: unknown,
  options?: { fallback?: string; joiner?: string },
): string {
  const fallback = options?.fallback ?? "Not specified";
  const joiner = options?.joiner ?? "\n";

  if (value == null) return fallback;
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => formatValueInline(v))
      .filter((s) => s.length > 0);
    return parts.length > 0 ? parts.join(", ") : fallback;
  }
  if (typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${formatKey(k)}: ${formatValueInline(v)}`);
    return parts.length > 0 ? parts.join(joiner) : fallback;
  }
  try {
    return String(value);
  } catch {
    return fallback;
  }
}

/** Inline (single-line) variant of formatValue used inside object/array entries. */
function formatValueInline(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v.map(formatValueInline).filter(Boolean).join(", ");
  }
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .filter(([, val]) => val != null && val !== "")
      .map(([k, val]) => `${formatKey(k)}: ${formatValueInline(val)}`)
      .join(", ");
  }
  try {
    return String(v);
  } catch {
    return "";
  }
}

/** Format a list of unknown values into clean trimmed strings (skips empties). */
export function formatStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => formatValueInline(v))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Returns true when a scholarship is still open (rolling or future deadline).
 * Closed/expired scholarships and explicitly inactive ones are filtered out.
 *
 * Accepts any object that may have:
 *   - deadlineAt: ISO timestamp string
 *   - deadline:   free-form date string ("September 15, 2026", etc.)
 *   - isActive:   boolean (false = removed)
 */
export function isScholarshipOpen(s: {
  deadlineAt?: string | null;
  deadline?: string | null;
  isActive?: boolean | null;
} | null | undefined): boolean {
  if (!s) return false;
  if (s.isActive === false) return false;

  const raw = s.deadlineAt ?? s.deadline ?? null;
  if (!raw || typeof raw !== "string") return true; // rolling / unknown

  const trimmed = raw.trim();
  if (trimmed.length === 0) return true;
  if (/rolling|ongoing|year[\s-]?round|continuous|open/i.test(trimmed) && !/closed/i.test(trimmed)) {
    return true;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    // Some deadlines are vague text like "Varies"; keep visible.
    return true;
  }
  // End of the deadline day is still considered open.
  const endOfDay = new Date(parsed);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.getTime() >= Date.now();
}

/**
 * Convert a 0-100 match score into a soft, trustworthy fit label.
 * We intentionally never expose the raw percentage in the UI — the user
 * has asked us to keep ranking internal and surface confidence as words.
 */
export function fitLabel(score: number | null | undefined): string {
  if (typeof score !== "number" || Number.isNaN(score)) return "Worth exploring";
  if (score >= 70) return "Top match";
  if (score >= 55) return "Strong fit";
  if (score >= 40) return "Good fit";
  return "Worth exploring";
}

const URL_REGEX = /^https?:\/\/[^\s]+$/i;

/** Add `https://` if a URL looks like a bare host. */
function ensureScheme(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Safely open a URL in the system browser. Validates the URL and shows an
 * Alert (instead of throwing an unhandled promise rejection) if anything
 * goes wrong. Returns true on success, false otherwise.
 */
export async function safeOpenUrl(
  url: unknown,
  options?: { failureTitle?: string; failureMessage?: string },
): Promise<boolean> {
  const failureTitle = options?.failureTitle ?? "Couldn't open link";
  const failureMessage =
    options?.failureMessage ??
    "Could not open this link. Please try again later.";

  if (typeof url !== "string" || url.trim().length === 0) {
    Alert.alert(failureTitle, failureMessage);
    return false;
  }

  const target = ensureScheme(url);
  if (!URL_REGEX.test(target)) {
    Alert.alert(failureTitle, failureMessage);
    return false;
  }

  try {
    // canOpenURL can return false for https on some configurations; we still
    // attempt openURL and rely on its rejection for the real signal.
    const supported = await Linking.canOpenURL(target).catch(() => true);
    if (!supported) {
      Alert.alert(failureTitle, failureMessage);
      return false;
    }
    await Linking.openURL(target);
    return true;
  } catch {
    Alert.alert(failureTitle, failureMessage);
    return false;
  }
}

/**
 * Show a destructive confirmation prompt before removing a saved item from
 * the user's plan. Falls back to `window.confirm` on web (since
 * `Alert.alert` is a no-op there) and uses the native `Alert.alert` with a
 * destructive "Remove" button on iOS / Android.
 *
 * When `hasNotes` is true the prompt explicitly warns that the user's
 * saved note will also be deleted, so a stray tap doesn't silently wipe a
 * note they wrote. Shared by the career / college / scholarship detail
 * screens so the copy and behavior stay identical across them. (The
 * Saved tab list still has its own near-identical inline helper that
 * predates this utility — consolidating it is a future cleanup.)
 */
export function confirmRemoveFromPlan(
  label: string,
  hasNotes: boolean,
  onConfirm: () => void,
): void {
  const message = hasNotes
    ? `Remove "${label}" from your plan? This will also delete the note you saved.`
    : `Remove "${label}" from your plan?`;
  if (Platform.OS === "web") {
    const ok =
      typeof window !== "undefined" ? window.confirm(message) : true;
    if (ok) onConfirm();
    return;
  }
  Alert.alert("Remove from plan", message, [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: onConfirm },
  ]);
}
