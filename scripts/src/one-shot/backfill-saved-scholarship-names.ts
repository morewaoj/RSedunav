import pg from "pg";

const { Pool } = pg;

// One-shot backfill for `saved_scholarships.scholarship_name`.
//
// The column was added so the "Saved" badge on list pages can match by name
// when the displayed scholarship lacks a stable id (curated picks,
// recommendations). New saves snapshot the name, but rows saved before that
// fix have a NULL name. For those legacy rows we copy the canonical name
// from the `scholarships` table where the original id still resolves.
//
// Idempotent: only fills NULL names, so re-running is a no-op.
async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to run the backfill");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(`
      UPDATE saved_scholarships AS ss
      SET scholarship_name = s.name
      FROM scholarships AS s
      WHERE ss.scholarship_id = s.id
        AND ss.scholarship_name IS NULL
    `);
    console.log(
      `[backfill-saved-scholarship-names] filled scholarship_name on ${result.rowCount ?? 0} legacy row(s)`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[backfill-saved-scholarship-names] failed:", err);
  process.exitCode = 1;
});
