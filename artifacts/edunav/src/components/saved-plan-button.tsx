import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Check, Loader2, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth.js";
import { useResumePendingSave } from "@/hooks/use-resume-pending-save";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { buildSavedRowRecreatePayload } from "@/lib/saved-recreate";

type SavedKind = "college" | "career" | "scholarship" | "fellowship";

type SavedRow = {
  id?: number | string;
  collegeId?: number | string;
  scholarshipId?: number | string;
  careerTitle?: string | null;
  notes?: string | null;
  priority?: string | null;
  applicationStatus?: string | null;
  deadline?: string | null;
  matchScore?: number | null;
  skillsGap?: unknown;
  [k: string]: unknown;
};

type SavedItemsResponse = {
  colleges?: SavedRow[];
  careers?: SavedRow[];
  scholarships?: SavedRow[];
};

type CollegeSavePayload = {
  kind: "college";
  collegeId: number;
};

type CareerSavePayload = {
  kind: "career";
  careerTitle: string;
  onetCode?: string | null;
  matchScore?: number | null;
  education?: string | null;
  growth?: string | null;
  matchReasons?: string[] | null;
  skillsGap?: string[] | null;
  standOutTips?: string[] | null;
};

type ScholarshipSavePayload = {
  kind: "scholarship";
  scholarshipId: number;
  deadline?: string | null;
  // Snapshot of the scholarship's display name. Persisted on the saved row
  // so list pages can match the "Saved" badge by name when the displayed
  // pick has no stable id (curated/recommendation entries).
  scholarshipName?: string | null;
};

type CommonProps = {
  className?: string;
  // User-facing label of the item — shown in the remove confirmation and
  // the undo toast so the user can tell which item they just removed.
  label?: string;
};

export type SavedPlanButtonProps =
  | (CollegeSavePayload & CommonProps)
  | (CareerSavePayload & CommonProps)
  | (ScholarshipSavePayload & CommonProps);

// sessionStorage key holding the user's pre-auth save intent so the
// SavedPlanButton can finish what they started: click Save → sign in →
// auto-save the same item without a second tap.
const PENDING_SAVE_KEY = "edunav:pending-save";

type PendingSaveIntent =
  | { kind: "college"; collegeId: number; label: string | null }
  | { kind: "career"; careerTitle: string; label: string | null }
  | { kind: "scholarship"; scholarshipId: number; label: string | null }
  | { kind: "fellowship"; fellowshipId: number; label: string | null };

// Display-only summary of the pending save intent, exposed so the /auth
// page can show the user what they're about to save once they sign in
// without depending on the rest of the SavedPlanButton internals.
export type PendingSaveSummary = {
  kind: SavedKind;
  label: string | null;
};

function readPendingSave(): PendingSaveIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as
      | (Partial<PendingSaveIntent> & { label?: unknown })
      | null;
    if (!parsed || typeof parsed !== "object") return null;
    const label =
      typeof parsed.label === "string" && parsed.label.trim()
        ? parsed.label.trim()
        : null;
    if (parsed.kind === "college" && Number.isFinite(parsed.collegeId)) {
      return { kind: "college", collegeId: Number(parsed.collegeId), label };
    }
    if (parsed.kind === "scholarship" && Number.isFinite(parsed.scholarshipId)) {
      return {
        kind: "scholarship",
        scholarshipId: Number(parsed.scholarshipId),
        label,
      };
    }
    if (parsed.kind === "fellowship" && Number.isFinite(parsed.fellowshipId)) {
      return {
        kind: "fellowship",
        fellowshipId: Number(parsed.fellowshipId),
        label,
      };
    }
    if (parsed.kind === "career" && typeof parsed.careerTitle === "string") {
      const title = parsed.careerTitle.trim();
      if (title) return { kind: "career", careerTitle: title, label };
    }
  } catch {
    // ignore malformed JSON / storage errors
  }
  return null;
}

// Display-only view of the current pending-save intent. Returns null when
// no intent is queued (or the stored payload is malformed). Used by the
// /auth page to render a banner naming the item the user is about to save.
export function readPendingSaveSummary(): PendingSaveSummary | null {
  const intent = readPendingSave();
  if (!intent) return null;
  return { kind: intent.kind, label: intent.label };
}

function clearPendingSave(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_SAVE_KEY);
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

// Fellowship's Save button lives outside the SavedPlanButton component
// (the Fellowships page renders its own bookmark control), so expose
// dedicated read/write/clear helpers that share the same sessionStorage
// slot. This keeps the Save → sign in → auto-save loop consistent across
// surfaces without forcing fellowships through SavedPlanButton's UI.
export function writePendingFellowshipSave(args: {
  fellowshipId: number;
  label?: string | null;
}): void {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(args.fellowshipId)) return;
  const label =
    typeof args.label === "string" && args.label.trim() ? args.label.trim() : null;
  const intent: PendingSaveIntent = {
    kind: "fellowship",
    fellowshipId: Number(args.fellowshipId),
    label,
  };
  try {
    window.sessionStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(intent));
  } catch {
    // ignore storage errors
  }
}

export function readPendingFellowshipSave():
  | { fellowshipId: number; label: string | null }
  | null {
  const intent = readPendingSave();
  if (!intent || intent.kind !== "fellowship") return null;
  return { fellowshipId: intent.fellowshipId, label: intent.label };
}

// Only clears the pending intent if it's a fellowship one so we don't
// drop another surface's queued save (e.g. user tapped Save on a college
// then navigated through Fellowships before signing in).
export function clearPendingFellowshipSave(): void {
  const intent = readPendingSave();
  if (intent?.kind === "fellowship") clearPendingSave();
}

function writePendingSave(props: SavedPlanButtonProps): void {
  if (typeof window === "undefined") return;
  // Capture the user-facing label too so the /auth page can show what
  // the user is about to save (e.g. "Sign in to save Stanford University
  // to your plan") instead of a generic prompt.
  const label =
    typeof props.label === "string" && props.label.trim()
      ? props.label.trim()
      : null;
  let intent: PendingSaveIntent | null = null;
  if (props.kind === "college" && Number.isFinite(props.collegeId)) {
    intent = { kind: "college", collegeId: Number(props.collegeId), label };
  } else if (
    props.kind === "scholarship" &&
    Number.isFinite(props.scholarshipId)
  ) {
    intent = {
      kind: "scholarship",
      scholarshipId: Number(props.scholarshipId),
      label,
    };
  } else if (props.kind === "career") {
    const title = (props.careerTitle ?? "").trim();
    if (title) intent = { kind: "career", careerTitle: title, label };
  }
  if (!intent) return;
  try {
    window.sessionStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(intent));
  } catch {
    // ignore storage errors
  }
}

function intentMatchesProps(
  intent: PendingSaveIntent,
  props: SavedPlanButtonProps,
): boolean {
  if (intent.kind !== props.kind) return false;
  if (intent.kind === "college" && props.kind === "college") {
    return Number(intent.collegeId) === Number(props.collegeId);
  }
  if (intent.kind === "scholarship" && props.kind === "scholarship") {
    return Number(intent.scholarshipId) === Number(props.scholarshipId);
  }
  if (intent.kind === "career" && props.kind === "career") {
    const a = intent.careerTitle.trim().toLowerCase();
    const b = (props.careerTitle ?? "").trim().toLowerCase();
    return !!a && a === b;
  }
  return false;
}

function postEndpoint(kind: SavedKind): string {
  if (kind === "college") return "/api/saved-colleges";
  if (kind === "scholarship") return "/api/saved-scholarships";
  return "/api/saved-careers";
}

function deleteEndpoint(kind: SavedKind, rowId: number): string {
  if (kind === "college") return `/api/saved-colleges/${rowId}`;
  if (kind === "scholarship") return `/api/saved-scholarships/${rowId}`;
  return `/api/saved-careers/${rowId}`;
}

function findSavedRow(
  data: SavedItemsResponse | null | undefined,
  kind: SavedKind,
  match: { id?: number | string | null; title?: string | null },
): SavedRow | null {
  if (!data) return null;
  if (kind === "college") {
    const target = match.id != null ? String(match.id) : "";
    if (!target || !Array.isArray(data.colleges)) return null;
    return (
      data.colleges.find((row) => {
        const candidate = row.collegeId ?? row.id;
        return candidate !== undefined && String(candidate) === target;
      }) ?? null
    );
  }
  if (kind === "scholarship") {
    const target = match.id != null ? String(match.id) : "";
    if (!target || !Array.isArray(data.scholarships)) return null;
    return (
      data.scholarships.find((row) => {
        const candidate = row.scholarshipId ?? row.id;
        return candidate !== undefined && String(candidate) === target;
      }) ?? null
    );
  }
  const target = (match.title ?? "").trim().toLowerCase();
  if (!target || !Array.isArray(data.careers)) return null;
  return (
    data.careers.find((row) => {
      const t =
        typeof row.careerTitle === "string" ? row.careerTitle.trim().toLowerCase() : "";
      return t.length > 0 && t === target;
    }) ?? null
  );
}

// Build the per-kind fallbacks the shared `buildSavedRowRecreatePayload`
// helper needs from the button's component props, so a re-create POST
// can fill in fields the captured row might be missing (e.g. the
// scholarship name snapshot, the career title).
function recreateFallbacks(
  props: SavedPlanButtonProps,
): Parameters<typeof buildSavedRowRecreatePayload>[3] {
  if (props.kind === "college") {
    return { collegeId: props.collegeId };
  }
  if (props.kind === "scholarship") {
    return {
      scholarshipId: props.scholarshipId,
      scholarshipDeadline: props.deadline ?? null,
      // Prefer the explicit scholarshipName prop; fall back to the
      // user-facing `label` so any caller that already passes the name
      // there still snapshots it onto the re-created row.
      scholarshipName:
        (typeof props.scholarshipName === "string" && props.scholarshipName.trim()) ||
        (typeof props.label === "string" && props.label.trim()) ||
        null,
    };
  }
  return { careerTitle: props.careerTitle };
}

export function SavedPlanButton(props: SavedPlanButtonProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [location] = useLocation();

  const savedItemsQ = useQuery<SavedItemsResponse | null>({
    queryKey: ["/api/saved-items", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await fetch(`/api/saved-items/${encodeURIComponent(userId)}`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return (await res.json()) as SavedItemsResponse;
    },
    enabled: !!userId,
  });

  const matchInfo = useMemo(() => {
    if (props.kind === "college") return { id: props.collegeId, title: null };
    if (props.kind === "scholarship") return { id: props.scholarshipId, title: null };
    return { id: null, title: props.careerTitle };
  }, [props]);

  const savedRow = findSavedRow(savedItemsQ.data, props.kind, matchInfo);
  const alreadyInPlan = !!savedRow;

  const saveM = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("You need to be signed in to save items.");
      let body: Record<string, unknown>;
      if (props.kind === "college") {
        if (!Number.isFinite(props.collegeId)) {
          throw new Error("This college can't be saved (invalid id).");
        }
        body = { userId, collegeId: props.collegeId };
      } else if (props.kind === "scholarship") {
        if (!Number.isFinite(props.scholarshipId)) {
          throw new Error("This scholarship can't be saved (invalid id).");
        }
        // Prefer the explicit scholarshipName prop; fall back to the
        // user-facing `label` so any caller that already passes the name
        // there (most do) still snapshots it onto the saved row.
        const scholarshipName =
          (typeof props.scholarshipName === "string" && props.scholarshipName.trim()) ||
          (typeof props.label === "string" && props.label.trim()) ||
          null;
        body = {
          userId,
          scholarshipId: props.scholarshipId,
          deadline: props.deadline ?? null,
          ...(scholarshipName ? { scholarshipName } : {}),
        };
      } else {
        const title = props.careerTitle?.trim();
        if (!title) {
          throw new Error("This career can't be saved (missing title).");
        }
        body = {
          userId,
          careerTitle: title,
          onetCode: props.onetCode ?? null,
          matchScore:
            typeof props.matchScore === "number" ? Math.round(props.matchScore) : 0,
          education: props.education ?? null,
          growth: props.growth ?? null,
          matchReasons: props.matchReasons ?? null,
          skillsGap: props.skillsGap ?? null,
          standOutTips: props.standOutTips ?? null,
        };
      }
      const res = await apiRequest("POST", postEndpoint(props.kind), body);
      return (await res.json()) as { duplicate?: boolean };
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", userId] });
      if (result?.duplicate) {
        toast({
          title: "Already in your plan",
          description: "This item is already saved to your plan.",
        });
      } else {
        toast({
          title: "Saved to your plan",
          description: "Find it under My Plan.",
        });
      }
    },
    onError: (e) => {
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Re-POST the saved-* row using the payload captured just before the
  // DELETE so the user gets the same notes / priority / status back in one
  // tap. Used by the undo action on the remove toast.
  const undoM = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiRequest("POST", postEndpoint(props.kind), payload);
      return (await res.json()) as { duplicate?: boolean };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", userId] });
    },
    onError: (e) => {
      toast({
        title: "Couldn't undo",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Removes the saved-* row directly from the detail screen so a user
  // viewing an item they already saved doesn't have to back out to the
  // My Plan list to take it off their plan. Mirrors the mobile detail
  // screens (career / college / scholarship): confirm, DELETE, then a
  // 5s undo toast that re-POSTs the captured row on tap.
  const removeM = useMutation({
    mutationFn: async (vars: {
      label: string;
      recreatePayload: Record<string, unknown> | null;
    }) => {
      const rawId = savedRow?.id;
      const rowId = typeof rawId === "number" ? rawId : Number(rawId);
      if (!Number.isFinite(rowId)) {
        throw new Error("This item can't be removed right now.");
      }
      await apiRequest("DELETE", deleteEndpoint(props.kind, rowId));
      return vars;
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", userId] });
      // Reset the save mutation so the primary button doesn't stay in
      // its lingering "Saved to your plan" state after a same-session
      // Save → Remove flow. Without this `inPlan` (which OR's in
      // `saveM.isSuccess`) would leave the button disabled even though
      // the row is gone server-side.
      saveM.reset();
      const undoPayload = variables.recreatePayload;
      toast({
        title: `Removed "${variables.label}" from your plan`,
        // Match the mobile snackbar window — Radix toast defaults to
        // ~5s already, but pin it explicitly so the two surfaces stay in
        // sync if the global default ever changes.
        duration: 5000,
        // Suppress the Undo affordance when the shared recreate helper
        // couldn't build a payload (missing FK / title) — mirrors the
        // My Plan list's behavior so neither surface offers an undo
        // that would immediately fail.
        action: undoPayload ? (
          <ToastAction
            altText="Undo remove"
            onClick={() => undoM.mutate(undoPayload)}
          >
            Undo
          </ToastAction>
        ) : undefined,
      });
    },
    onError: (e) => {
      toast({
        title: "Couldn't remove",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRemove = () => {
    if (!userId || !savedRow) return;
    const fallbackLabel =
      props.kind === "career"
        ? props.careerTitle
        : props.kind === "college"
          ? "this college"
          : "this scholarship";
    const label =
      (typeof props.label === "string" && props.label.trim()) || fallbackLabel || "this item";
    if (typeof window !== "undefined") {
      const ok = window.confirm(`Remove "${label}" from your plan?`);
      if (!ok) return;
    }
    const recreatePayload = buildSavedRowRecreatePayload(
      props.kind,
      savedRow,
      userId,
      recreateFallbacks(props),
    );
    removeM.mutate({ label, recreatePayload });
  };

  const inPlan = alreadyInPlan || saveM.isSuccess;
  const disabled = inPlan || saveM.isPending;

  // Once the user comes back from /auth (or signs in any other way) check
  // for a pending save intent that matches this button's item and finish
  // the save automatically. The shared hook handles the ref guard, the
  // wait for the saved-items duplicate-check data, and the clear-on-no-op
  // so this button stays in lock-step with every other Save surface.
  useResumePendingSave({
    enabled: !!userId,
    isReady: !savedItemsQ.isLoading,
    // Only claim the intent if it targets this button's item; returning
    // null leaves the slot armed for whichever mount actually owns it.
    readIntent: () => {
      const intent = readPendingSave();
      return intent && intentMatchesProps(intent, props) ? intent : null;
    },
    clearIntent: clearPendingSave,
    isAlreadySaved: () => alreadyInPlan,
    onResume: () => saveM.mutate(),
  });

  if (!userId) {
    const redirectTarget = location && location.startsWith("/") ? location : "/";
    const authHref = `/auth?redirect=${encodeURIComponent(redirectTarget)}`;
    return (
      <Button
        asChild
        type="button"
        className={props.className ?? "w-full"}
        variant="default"
        data-testid="button-save-to-plan"
      >
        <Link href={authHref} onClick={() => writePendingSave(props)}>
          <Bookmark className="h-4 w-4 mr-2" />
          Sign in to save
        </Link>
      </Button>
    );
  }

  // When the item is already in the plan we still render the saved-state
  // pill (so the affordance stays consistent across the app) and add a
  // secondary destructive action right below it for the in-place remove.
  // The remove button is only mounted while `alreadyInPlan` is true so the
  // optimistic post-save state (`saveM.isSuccess` before the saved-items
  // refetch lands) doesn't briefly show a Remove button that has no row
  // to delete yet.
  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={() => saveM.mutate()}
        disabled={disabled}
        className={props.className ?? "w-full"}
        variant={inPlan ? "secondary" : "default"}
        data-testid="button-save-to-plan"
        aria-pressed={inPlan}
      >
        {inPlan ? (
          <Check className="h-4 w-4 mr-2" />
        ) : (
          <Bookmark className="h-4 w-4 mr-2" />
        )}
        {saveM.isPending
          ? "Saving…"
          : inPlan
            ? "Saved to your plan"
            : "Save to my plan"}
      </Button>
      {alreadyInPlan ? (
        <Button
          type="button"
          variant="outline"
          onClick={handleRemove}
          disabled={removeM.isPending}
          className="w-full border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
          data-testid="button-remove-from-plan"
        >
          {removeM.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          {removeM.isPending ? "Removing…" : "Remove from plan"}
        </Button>
      ) : null}
    </div>
  );
}
