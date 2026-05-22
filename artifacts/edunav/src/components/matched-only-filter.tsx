import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Shared "Matched to me" wiring used by every web search surface
// (colleges, scholarships, careers). Keeping the toggle state, the
// hidden-when-no-matches gating, the "reset toggle when matches go away"
// effect, the Sparkles pill, and the empty-state copy in one place
// prevents the surfaces from silently drifting apart as we add more.

interface UseMatchedOnlyFilterOptions {
  hasMatches: boolean;
}

interface UseMatchedOnlyFilterResult {
  matchedOnly: boolean;
  setMatchedOnly: React.Dispatch<React.SetStateAction<boolean>>;
}

// Bundles the local toggle state with the "if matches go away, turn the
// filter off so the list isn't stuck empty" effect that every surface
// has needed so far.
export function useMatchedOnlyFilter({
  hasMatches,
}: UseMatchedOnlyFilterOptions): UseMatchedOnlyFilterResult {
  const [matchedOnly, setMatchedOnly] = useState(false);

  useEffect(() => {
    if (matchedOnly && !hasMatches) setMatchedOnly(false);
  }, [matchedOnly, hasMatches]);

  return { matchedOnly, setMatchedOnly };
}

interface MatchedOnlyToggleProps {
  hasMatches: boolean;
  active: boolean;
  onToggle: () => void;
  // data-testid is required so each surface keeps its existing
  // surface-specific selector (e.g. button-matched-to-me-colleges).
  testId: string;
  // Caller-controlled wrapper so each surface can position the pill
  // (mt-4, mb-4, justify-center, etc.) without forking the pill itself.
  containerClassName?: string;
}

// Sparkles-icon pill. Renders nothing when there are no matches so the
// toggle never has a chance to render an empty list by accident.
export function MatchedOnlyToggle({
  hasMatches,
  active,
  onToggle,
  testId,
  containerClassName = "flex flex-wrap gap-2",
}: MatchedOnlyToggleProps) {
  if (!hasMatches) return null;
  return (
    <div className={containerClassName}>
      <Button
        type="button"
        variant={active ? "default" : "outline"}
        size="sm"
        onClick={onToggle}
        aria-pressed={active}
        data-testid={testId}
        className="rounded-full text-xs"
      >
        <Sparkles
          className={`h-3.5 w-3.5 mr-1.5 ${active ? "fill-current" : ""}`}
        />
        Matched to me
      </Button>
    </div>
  );
}

interface MatchedOnlyEmptyHintProps {
  // Caller decides when to render based on totals it already has handy
  // (e.g. matchedOnly && hasMatches && totalCount > 0 && visibleCount === 0).
  // Component returns null when not visible to keep call sites tidy.
  visible: boolean;
  cardClassName?: string;
  contentClassName?: string;
}

// Empty-state hint shown when the toggle filters every result away.
// Copy lives here so it can't drift between surfaces.
export function MatchedOnlyEmptyHint({
  visible,
  cardClassName,
  contentClassName = "p-4 flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300",
}: MatchedOnlyEmptyHintProps) {
  if (!visible) return null;
  return (
    <Card className={cardClassName}>
      <CardContent className={contentClassName}>
        <Sparkles className="h-4 w-4 mt-0.5 text-blue-600" />
        <span>
          None of these results overlap with your saved profile picks.
          Turn off the filter to see them all.
        </span>
      </CardContent>
    </Card>
  );
}
