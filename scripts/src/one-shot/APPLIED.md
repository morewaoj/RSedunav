# Applied one-shot migrations

This file is the registry of one-shot data migrations that have been run
against the **production** database. Append a new entry whenever you apply
one. See [`README.md`](./README.md) for the full procedure.

| Script | Applied to prod | Notes |
| --- | --- | --- |
| `backfill-saved-scholarship-names.ts` | 2026-04 | Filled legacy `NULL` values in `saved_scholarships.scholarship_name` so the "Saved" badge can match by name on list pages. Originally ran via `scripts/post-merge.sh` until that bespoke line was removed. |
