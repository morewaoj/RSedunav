#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Use push-force so additive schema changes (e.g. unique constraints on
# tables with existing rows) don't hang on drizzle-kit's interactive prompt.
pnpm --filter db push-force
# One-shot data migrations are NOT run automatically here. See
# `scripts/src/one-shot/README.md` for how to apply them and the
# `APPLIED.md` registry that records what has already been run in prod.
