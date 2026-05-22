import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

const DEFAULT_THRESHOLD_MS = 30 * 1000;

export type UseAutoRefreshOnFocusOptions = {
  /**
   * Minimum time between background refetches. Skips a refetch if the
   * last successful fetch landed within this window. Defaults to 30s.
   */
  thresholdMs?: number;
  /**
   * For screens whose component remounts on every visit (e.g. sub-tabs
   * that are conditionally rendered), pass the React Query
   * `q.isFetching` and `q.dataUpdatedAt` here. They live on the
   * QueryClient and survive remounts, so the dedupe gate still works.
   *
   * For top-level screens that stay mounted, omit these — the hook
   * tracks a local "last fetched at" / "is fetching" pair internally.
   */
  isFetching?: boolean;
  dataUpdatedAt?: number;
};

export type UseAutoRefreshOnFocusResult = {
  /**
   * Stamp the internal "last fetched at" so an immediate focus or
   * AppState 'active' won't pile a silent auto-refresh on top.
   * Call this from manual triggers (e.g. pull-to-refresh) after they
   * finish, so the dedupe window covers manual refreshes too — same
   * behavior as the original copy-pasted blocks.
   *
   * No-op when the caller passes external `dataUpdatedAt` (sub-tab
   * mode), since the QueryClient timestamp already reflects manual
   * refetches.
   */
  markRefreshed: () => void;
};

/**
 * Silently refetch a query (or set of queries) when the screen regains
 * focus or the app returns from background. Mirrors the original
 * copy-pasted pattern that lived in HomeTab, SavedScreen, ProfileTab,
 * ForYouView and ResumeView.
 *
 * The caller passes a single `refetch` callback; for multi-query
 * screens, wrap the refetches in a `Promise.all` inside the callback.
 *
 * Dedupe behavior:
 *   - Skips if a refresh is already in flight.
 *   - Skips if the last successful refresh was within `thresholdMs`.
 *   - Stamps the start of a refresh so two near-simultaneous triggers
 *     (AppState 'active' + tab focus) don't both kick off a duplicate
 *     request before the first one finishes.
 *   - Manual triggers (e.g. pull-to-refresh) should call the returned
 *     `markRefreshed()` after finishing so they participate in the
 *     same window.
 *
 * Fire-and-forget: this hook never toggles a spinner. Pull-to-refresh
 * remains the manual override on screens that have it.
 */
export function useAutoRefreshOnFocus(
  refetch: () => Promise<unknown> | unknown,
  options?: UseAutoRefreshOnFocusOptions,
): UseAutoRefreshOnFocusResult {
  const thresholdMs = options?.thresholdMs ?? DEFAULT_THRESHOLD_MS;
  const externalIsFetching = options?.isFetching;
  const externalDataUpdatedAt = options?.dataUpdatedAt;
  const usesExternal =
    externalIsFetching !== undefined || externalDataUpdatedAt !== undefined;

  // Internal dedupe state for screens that stay mounted. Initialized to
  // "now" so the very first focus right after mount doesn't pile a
  // duplicate refetch on top of the queries that are already running.
  // For sub-tabs that pass external state, we leave it at 0 so the
  // external `dataUpdatedAt` is the source of truth.
  const lastFetchedAtRef = useRef<number>(usesExternal ? 0 : Date.now());
  const isFetchingRef = useRef<boolean>(false);

  // Latest values held in refs so the AppState listener and focus
  // callback don't tear down on every render when the caller passes a
  // new callback identity.
  const refetchRef = useRef(refetch);
  const externalIsFetchingRef = useRef(externalIsFetching);
  const externalDataUpdatedAtRef = useRef(externalDataUpdatedAt);
  const thresholdMsRef = useRef(thresholdMs);

  useEffect(() => {
    refetchRef.current = refetch;
    externalIsFetchingRef.current = externalIsFetching;
    externalDataUpdatedAtRef.current = externalDataUpdatedAt;
    thresholdMsRef.current = thresholdMs;
  });

  const maybeAutoRefresh = useCallback(() => {
    const externalFetching = externalIsFetchingRef.current;
    if (externalFetching ?? isFetchingRef.current) return;

    const now = Date.now();
    const externalStamp = externalDataUpdatedAtRef.current;
    const stamped = externalStamp ?? lastFetchedAtRef.current;
    if (stamped > 0 && now - stamped < thresholdMsRef.current) return;

    // Stamp the start of the refresh so a near-simultaneous trigger
    // (e.g. AppState 'active' fires alongside tab focus) doesn't kick
    // off a duplicate before the first one finishes.
    lastFetchedAtRef.current = now;
    isFetchingRef.current = true;

    void Promise.resolve()
      .then(() => refetchRef.current())
      .finally(() => {
        lastFetchedAtRef.current = Date.now();
        isFetchingRef.current = false;
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      maybeAutoRefresh();
      return undefined;
    }, [maybeAutoRefresh]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") maybeAutoRefresh();
    });
    return () => sub.remove();
  }, [maybeAutoRefresh]);

  const markRefreshed = useCallback(() => {
    lastFetchedAtRef.current = Date.now();
  }, []);

  return { markRefreshed };
}

export type UseRefreshSetOptions = UseAutoRefreshOnFocusOptions;

export type UseRefreshSetResult = {
  /**
   * Manual pull-to-refresh handler. Awaits the caller's `refetchAll`
   * and then stamps the auto-refresh window so an immediate focus or
   * AppState 'active' fired right after a manual pull doesn't trigger
   * an extra silent refetch within the threshold.
   */
  refresh: () => Promise<void>;
  /**
   * `true` while a manual `refresh()` call is in flight. Suitable for
   * driving `<RefreshControl refreshing={...} />` on screens that don't
   * have a single React Query `isRefetching` to lean on (because they
   * fan out to multiple queries).
   */
  isRefreshing: boolean;
};

/**
 * Bundles the silent-refresh-on-focus + manual-pull stamping pattern
 * that previously lived as a try/finally + markRefreshed dance copy-
 * pasted into HomeTab, SavedScreen, Careers, Colleges and Scholarships.
 *
 * Pass a memoized `refetchAll` (typically a `useCallback` that does
 * `Promise.all([...refetches])`). The returned `refresh` is the manual
 * pull-to-refresh handler — wire it into `RefreshControl.onRefresh` —
 * and `isRefreshing` tracks whether that manual pull is still running.
 *
 * Adopting this hook makes it impossible for a new browse tab to
 * silently forget the `markRefreshed()` stamp after a manual pull (and
 * thereby double-fetch within the threshold), or to stamp the window
 * before the refetch resolves.
 */
export function useRefreshSet(
  refetchAll: () => Promise<unknown> | unknown,
  options?: UseRefreshSetOptions,
): UseRefreshSetResult {
  const { markRefreshed } = useAutoRefreshOnFocus(refetchAll, options);

  // Track the latest `refetchAll` in a ref so `refresh` keeps a stable
  // identity — pull-to-refresh handlers are typically passed through
  // memoized props (RefreshControl), and re-creating them on every
  // render would defeat that.
  const refetchAllRef = useRef(refetchAll);
  useEffect(() => {
    refetchAllRef.current = refetchAll;
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetchAllRef.current();
    } finally {
      setIsRefreshing(false);
      markRefreshed();
    }
  }, [markRefreshed]);

  return { refresh, isRefreshing };
}
