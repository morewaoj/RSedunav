#!/usr/bin/env node
/**
 * Post-capture sanity check: assert that capture-simulator.mjs produced all
 * seven expected PNGs at the exact App Store / Play Store dimensions. Run
 * after the capture step in CI so a missing file or a wrong-size image
 * fails the workflow loudly instead of silently uploading a bad asset set.
 *
 * Uses ImageMagick's `identify` (already required for the resize step in
 * capture-simulator.mjs, so no extra dependency).
 *
 * Usage: node scripts/store-screens/verify-screens.mjs --platform=ios|android
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

// Single source of truth for the screenshot route list — see routes.json.
// capture-simulator.mjs, generate.mjs, and the open-pr job in
// .github/workflows/store-screenshots.yml all read the same file.
const SLUGS = JSON.parse(
  readFileSync(join(__dirname, "routes.json"), "utf8"),
).map((r) => r.slug);
const TARGETS = {
  ios: { dir: "ios", width: 1290, height: 2796 },
  android: { dir: "android", width: 1080, height: 1920 },
};

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function dimensions(file) {
  const r = spawnSync("magick", ["identify", "-format", "%w %h", file], {
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`identify failed for ${file}: ${r.stderr || r.stdout}`);
  }
  const [w, h] = r.stdout.trim().split(/\s+/).map(Number);
  return { width: w, height: h };
}

function main() {
  const args = parseArgs(process.argv);
  const target = TARGETS[args.platform];
  if (!target) {
    console.error("Usage: verify-screens.mjs --platform=ios|android");
    process.exit(2);
  }
  const dir = join(ROOT, "assets", "store", target.dir);
  const errors = [];
  for (const slug of SLUGS) {
    const file = join(dir, `${slug}.png`);
    if (!existsSync(file)) {
      errors.push(`MISSING: ${file}`);
      continue;
    }
    if (statSync(file).size < 1024) {
      errors.push(`TOO SMALL (<1KB): ${file}`);
      continue;
    }
    const d = dimensions(file);
    if (d.width !== target.width || d.height !== target.height) {
      errors.push(
        `WRONG SIZE: ${file} is ${d.width}x${d.height}, expected ${target.width}x${target.height}`,
      );
    } else {
      console.log(`ok  ${slug}.png  ${d.width}x${d.height}`);
    }
  }
  if (errors.length > 0) {
    console.error("\nVerification failed:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`\nAll ${SLUGS.length} ${args.platform} screenshots verified.`);
}

main();
