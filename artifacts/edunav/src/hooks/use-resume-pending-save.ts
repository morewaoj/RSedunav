import { useEffect, useRef } from "react";

// Shared "after sign in, finish the queued save" effect used by every
// surface that participates in the Save → sign in → auto-save loop
// (SavedPlanButton on the college / career / scholarship detail screens
// and the standalone Save button on the Fellowships page). Centralising
// the wiring keeps the four critical guards consistent across surfaces:
//
//   1. only fires once per mount (ref guard so a re-render can't
//      re-trigger the POST after the first one resolves)
//   2. waits for the user to be present (no-op for signed-out renders)
//   3. waits for the saved-items duplicate-check data to load (so we
//      don't fire a redundant save that would surface as a misleading
//      "Already in your plan" toast)
//   4. always clears the pending intent before deciding whether to POST,
//      so a no-op (intent matches but item is already saved) doesn't
//      leave the slot armed for the next page load
//
// The effect's `readIntent` callback should return null when the queued
// intent doesn't belong to this surface — that way another mount can
// still pick it up. Returning a non-null value is treated as "this
// mount owns the intent": we clear it and (if needed) call `onResume`.
export function useResumePendingSave<TIntent>(opts: {
  // True when the user is signed in (or otherwise eligible to save).
  // Usually the truthy `userId` from the auth context.
  enabled: boolean;
  // True once the per-surface duplicate-check query has resolved. Pass
  // `!savedItemsQuery.isLoading` so the effect waits for the data it
  // needs to decide whether `isAlreadySaved` should suppress the POST.
  isReady: boolean;
  // Returns the queued intent if (and only if) it belongs to this
  // surface. Returning null means "no intent for me right now" and the
  // effect leaves the sessionStorage slot untouched for another mount.
  readIntent: () => TIntent | null;
  // Removes the queued intent from sessionStorage. Called once we've
  // claimed the intent for this surface, before deciding whether to
  // actually fire `onResume`, so a duplicate intent is still cleared.
  clearIntent: () => void;
  // Returns true when the item the intent points at is already saved
  // server-side. When true we skip `onResume` to avoid the duplicate
  // POST and the "Already in your plan" toast that would follow it.
  isAlreadySaved: (intent: TIntent) => boolean;
  // Performs the actual save (typically `mutation.mutate(...)`).
  onResume: (intent: TIntent) => void;
}): void {
  const { enabled, isReady, readIntent, clearIntent, isAlreadySaved, onResume } = opts;
  const handledRef = useRef(false);
  useEffect(() => {
    if (handledRef.current) return;
    if (!enabled) return;
    if (!isReady) return;
    const intent = readIntent();
    if (intent == null) return;
    handledRef.current = true;
    clearIntent();
    if (isAlreadySaved(intent)) return;
    onResume(intent);
    // The callbacks are intentionally omitted from the dep list — the
    // effect should re-evaluate only when the user becomes eligible or
    // the duplicate-check data first resolves, not on every render that
    // produces a fresh closure for the callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isReady]);
}
