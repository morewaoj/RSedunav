# One-shot data migrations

This directory holds **one-shot data migrations** — scripts that need to run
against a database exactly once (typically to backfill or repair data that
schema migrations alone can't fix).

These are intentionally **not** wired into `scripts/post-merge.sh`. Leaving
project-specific one-shots in the always-on post-merge step adds drift over
time and silently re-runs scripts long after they're needed.

## Conventions

- **One file per migration.** Name it descriptively, e.g.
  `backfill-saved-scholarship-names.ts`.
- **Make it idempotent.** A re-run on already-migrated data must be a safe
  no-op. Prefer `WHERE ... IS NULL` style guards over blanket updates.
- **Expose it as a script** in `scripts/package.json` under the
  `one-shot:<name>` namespace, e.g.
  `"one-shot:backfill-saved-scholarship-names": "tsx ./src/one-shot/backfill-saved-scholarship-names.ts"`.
- **Read `DATABASE_URL` from the environment.** Fail loudly if it's missing.
- **Log how many rows were touched** so the operator can confirm it ran.

## How to apply one to production

1. Land the script in this directory and a corresponding `one-shot:<name>`
   entry in `scripts/package.json`.
2. Run it manually against the production database, e.g.
   `DATABASE_URL=<prod-url> pnpm --filter @workspace/scripts run one-shot:<name>`.
3. Append an entry to [`APPLIED.md`](./APPLIED.md) recording the date the
   script was applied to production. Keep the script file and the registry
   entry around as a record; delete only if the table/column it touched is
   itself removed.

## Why not auto-run them?

A central runner that records "applied" state in the database would also
work, but it's overkill for the volume of one-shots this project produces.
The README + `APPLIED.md` pair is the registry: it documents what exists,
what has shipped, and the procedure for adding the next one.
