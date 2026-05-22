// Shared "why this matched" chip styling and trim/cap helper used across
// the web app's college and career surfaces (search, explorer, and detail
// pages). Keeping the helper and the pill row in one place prevents the
// surfaces from silently drifting apart as we add more.

// Trim, drop blanks, and cap to a couple of short pills so cards stay
// scannable. Mirrors the mobile helper of the same name.
export function pickMatchReasons(
  reasons: string[] | null | undefined,
  max = 2,
): string[] {
  if (!Array.isArray(reasons)) return [];
  const cleaned = reasons
    .filter((r): r is string => typeof r === "string")
    .map((r) => r.replace(/\s+/g, " ").trim())
    .filter((r) => r.length > 0);
  return cleaned.slice(0, max);
}

// Chip size presets:
// - "sm" matches the list-card pills on /search and the careers explorer
// - "md" matches the larger header pills on the detail pages
export type MatchReasonChipSize = "sm" | "md";

const CHIP_BASE =
  "inline-flex items-center rounded-full border border-blue-200 bg-blue-50 font-medium text-blue-700";

const CHIP_SIZE: Record<MatchReasonChipSize, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-0.5 text-xs",
};

interface MatchReasonChipsProps {
  reasons: string[] | undefined;
  // Container class (margins, justify, etc.) is caller-controlled so each
  // surface can position the row appropriately without forking the chip
  // styling.
  className: string;
  testId: string;
  size?: MatchReasonChipSize;
}

// Tiny pill row used to render the per-surface "why this matched" reasons.
// Mirrors the mobile MatchReasonChips look so the two clients feel
// consistent. Renders nothing when there are no reasons.
export function MatchReasonChips({
  reasons,
  className,
  testId,
  size = "sm",
}: MatchReasonChipsProps) {
  if (!reasons || reasons.length === 0) return null;
  const chipClass = `${CHIP_BASE} ${CHIP_SIZE[size]}`;
  return (
    <div className={className} data-testid={testId}>
      {reasons.map((reason, idx) => (
        <span key={`${idx}-${reason}`} className={chipClass}>
          {reason}
        </span>
      ))}
    </div>
  );
}
