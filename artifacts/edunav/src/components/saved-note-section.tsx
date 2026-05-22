import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth.js";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export type SavedKind = "college" | "career" | "scholarship";

export type CollegePriority = "high" | "medium" | "low";
export type ScholarshipStatus = "interested" | "applied" | "awarded" | "rejected";

export const COLLEGE_PRIORITIES: Array<{ value: CollegePriority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const SCHOLARSHIP_STATUSES: Array<{ value: ScholarshipStatus; label: string }> = [
  { value: "interested", label: "Interested" },
  { value: "applied", label: "Applied" },
  { value: "awarded", label: "Awarded" },
  { value: "rejected", label: "Rejected" },
];

export function isCollegePriority(v: unknown): v is CollegePriority {
  return v === "high" || v === "medium" || v === "low";
}

export function isScholarshipStatus(v: unknown): v is ScholarshipStatus {
  return v === "interested" || v === "applied" || v === "awarded" || v === "rejected";
}

export function priorityLabel(v: unknown): string | null {
  if (!isCollegePriority(v)) return null;
  return COLLEGE_PRIORITIES.find((p) => p.value === v)?.label ?? null;
}

export function statusLabel(v: unknown): string | null {
  if (!isScholarshipStatus(v)) return null;
  return SCHOLARSHIP_STATUSES.find((s) => s.value === v)?.label ?? null;
}

type SavedRow = {
  id?: number | string;
  collegeId?: number | string;
  scholarshipId?: number | string;
  careerTitle?: string | null;
  notes?: string | null;
  priority?: string | null;
  applicationStatus?: string | null;
  [k: string]: unknown;
};

type SavedItemsResponse = {
  colleges?: SavedRow[];
  careers?: SavedRow[];
  scholarships?: SavedRow[];
};

function normalizeNote(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function patchEndpoint(kind: SavedKind, rowId: number): string {
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
  // career
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

export function SavedItemEditDialog({
  open,
  onOpenChange,
  kind,
  rowId,
  initialNotes,
  initialPriority,
  initialStatus,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: SavedKind;
  rowId: number;
  initialNotes: string | null;
  initialPriority?: CollegePriority | null;
  initialStatus?: ScholarshipStatus | null;
  label: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  // Default priority to "medium" so the UI always shows a selected pill,
  // matching the mobile EditModal behavior. We track `priorityTouched`
  // separately so a user who opens the dialog only to edit the note on a
  // college that never had a priority set doesn't silently get one
  // assigned by the PATCH. Same idea for scholarship status below.
  const [priorityDraft, setPriorityDraft] = useState<CollegePriority>("medium");
  const [priorityTouched, setPriorityTouched] = useState(false);
  const [statusDraft, setStatusDraft] = useState<ScholarshipStatus>("interested");
  const [statusTouched, setStatusTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(initialNotes ?? "");
    if (kind === "college") {
      setPriorityDraft(isCollegePriority(initialPriority) ? initialPriority : "medium");
      setPriorityTouched(false);
    } else if (kind === "scholarship") {
      setStatusDraft(isScholarshipStatus(initialStatus) ? initialStatus : "interested");
      setStatusTouched(false);
    }
  }, [open, initialNotes, initialPriority, initialStatus, kind, rowId]);

  const updateM = useMutation({
    mutationFn: async () => {
      if (!Number.isFinite(rowId)) throw new Error("Invalid saved item.");
      const body: Record<string, unknown> = { notes: normalizeNote(draft) };
      // Only send priority/applicationStatus when the user actually
      // picked a value, OR when one was already set on the row (so a
      // round-trip preserves it). Otherwise editing just the note on a
      // previously-unset row would silently assign the default.
      if (kind === "college" && (priorityTouched || isCollegePriority(initialPriority))) {
        body.priority = priorityDraft;
      }
      if (
        kind === "scholarship" &&
        (statusTouched || isScholarshipStatus(initialStatus))
      ) {
        body.applicationStatus = statusDraft;
      }
      await apiRequest("PATCH", patchEndpoint(kind, rowId), body);
    },
    onSuccess: () => {
      onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ["/api/saved-items"] });
      toast({ title: "Saved" });
    },
    onError: (e) => {
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const dialogTitle =
    kind === "college"
      ? "Edit college"
      : kind === "scholarship"
        ? "Edit scholarship"
        : "Edit note";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!updateM.isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription className="line-clamp-2">{label}</DialogDescription>
        </DialogHeader>
        {kind === "college" ? (
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">Priority</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Priority">
              {COLLEGE_PRIORITIES.map((p) => {
                const active = priorityDraft === p.value;
                return (
                  <Button
                    key={p.value}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setPriorityDraft(p.value);
                      setPriorityTouched(true);
                    }}
                    disabled={updateM.isPending}
                    data-testid={`button-priority-${p.value}`}
                    className="flex-1"
                  >
                    {p.label}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}
        {kind === "scholarship" ? (
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">
              Application status
            </span>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Application status"
            >
              {SCHOLARSHIP_STATUSES.map((s) => {
                const active = statusDraft === s.value;
                return (
                  <Button
                    key={s.value}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setStatusDraft(s.value);
                      setStatusTouched(true);
                    }}
                    disabled={updateM.isPending}
                    data-testid={`button-status-${s.value}`}
                  >
                    {s.label}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className={cn("flex items-center justify-between", (kind === "college" || kind === "scholarship") && "mt-1")}>
          <span className="text-sm font-medium text-foreground">Notes</span>
          {draft.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDraft("")}
              disabled={updateM.isPending}
              data-testid="button-clear-note"
              className="h-auto px-2 py-1 text-xs text-primary hover:text-primary"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear note
            </Button>
          ) : null}
        </div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Why is this on your plan? Add reminders or next steps."
          rows={6}
          maxLength={2000}
          data-testid="textarea-note"
        />
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateM.isPending}
            data-testid="button-cancel-note"
          >
            Cancel
          </Button>
          <Button
            onClick={() => updateM.mutate()}
            disabled={updateM.isPending}
            data-testid="button-save-note"
          >
            {updateM.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SavedNoteSection({
  kind,
  itemId,
  itemTitle,
  label,
}: {
  kind: SavedKind;
  itemId?: number | string | null;
  itemTitle?: string | null;
  label: string;
}) {
  const { user } = useAuth();
  const userId = user?.id;

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

  const savedRow = findSavedRow(savedItemsQ.data, kind, {
    id: itemId,
    title: itemTitle,
  });
  const savedNote = normalizeNote(savedRow?.notes);
  const rowIdRaw = savedRow?.id;
  const rowId = typeof rowIdRaw === "number" ? rowIdRaw : Number(rowIdRaw);

  const savedPriorityLabel =
    kind === "college" ? priorityLabel(savedRow?.priority) : null;
  const savedStatusLabel =
    kind === "scholarship" ? statusLabel(savedRow?.applicationStatus) : null;

  const [open, setOpen] = useState(false);

  // Hide entirely when not saved, or when there's nothing to show
  // (no note AND no priority/status). The card now also renders for a
  // saved item that only has a priority/status set, so users can see
  // and edit those values from the detail page.
  if (
    !savedRow ||
    !Number.isFinite(rowId) ||
    (!savedNote && !savedPriorityLabel && !savedStatusLabel)
  )
    return null;

  return (
    <>
      <Card data-testid="card-saved-note">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Pencil className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-gray-900">Your note</h3>
              {savedPriorityLabel ? (
                <Badge
                  variant="secondary"
                  className="text-xs font-medium"
                  data-testid="badge-saved-note-priority"
                >
                  {savedPriorityLabel} priority
                </Badge>
              ) : null}
              {savedStatusLabel ? (
                <Badge
                  variant="secondary"
                  className="text-xs font-medium"
                  data-testid="badge-saved-note-status"
                >
                  {savedStatusLabel}
                </Badge>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(true)}
              data-testid="button-edit-note"
              className="text-primary hover:text-primary"
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit note
            </Button>
          </div>
          {savedNote ? (
            <p
              className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700"
              data-testid="text-saved-note"
            >
              {savedNote}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <SavedItemEditDialog
        open={open}
        onOpenChange={setOpen}
        kind={kind}
        rowId={rowId}
        initialNotes={typeof savedRow.notes === "string" ? savedRow.notes : null}
        initialPriority={
          isCollegePriority(savedRow.priority) ? savedRow.priority : null
        }
        initialStatus={
          isScholarshipStatus(savedRow.applicationStatus)
            ? savedRow.applicationStatus
            : null
        }
        label={label}
      />
    </>
  );
}
