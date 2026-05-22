import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type SavedBadgeProps = {
  className?: string;
};

export function SavedBadge({ className }: SavedBadgeProps) {
  return (
    <span
      role="status"
      aria-label="Saved to your plan"
      data-testid="badge-saved"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground",
        className,
      )}
    >
      <Check className="h-3 w-3" />
      Saved
    </span>
  );
}
