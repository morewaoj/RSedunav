#!/usr/bin/env node
// Regenerates the two non-screenshot Play Store assets from the same brand
// values used by the phone-screenshot pipeline:
//
//   - feature-graphic.png (1024×500, 24-bit PNG, no alpha)
//   - icon-512.png        (512×512,  24-bit PNG, no alpha)
//
// Run directly to refresh both PNGs:
//
//   node scripts/store-screens/generate-play-extras.mjs
//
// Or import `generateFeatureGraphic` / `generateIcon512` from another script
// (e.g. generate.mjs) to bundle them into a larger pipeline.

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { COL, FEATURE_GRAPHIC } from "./brand.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const DEFAULT_OUT = join(ROOT, "assets", "store", "android");
const DEFAULT_ICON_SRC = join(ROOT, "assets", "images", "icon.png");

function escapeSvg(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function featureGraphicSVG() {
  const W = 1024, H = 500;
  const { wordmark, monogram, taglineLines, pills } = FEATURE_GRAPHIC;

  // Lay out the pill row left-to-right, sized to the label so longer words
  // (e.g. "Scholarships") don't get clipped if the wordmark copy changes.
  const pillY = 360;
  const pillH = 56;
  const pillGap = 16;
  let pillX = 300;
  let pillsSvg = "";
  for (const label of pills) {
    const pillW = Math.max(140, label.length * 18 + 60);
    pillsSvg += `
  <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="#FFFFFF" fill-opacity="0.18"/>
  <text x="${pillX + pillW / 2}" y="${pillY + pillH / 2 + 9}" text-anchor="middle" font-size="26" fill="#FFFFFF" font-weight="600" font-family="-apple-system, system-ui, Roboto">${escapeSvg(label)}</text>`;
    pillX += pillW + pillGap;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${COL.primary}"/>
      <stop offset="100%" stop-color="${COL.primaryEnd}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#brand)"/>
  <!-- Decorative blobs -->
  <circle cx="100" cy="80" r="220" fill="#FFFFFF" fill-opacity="0.08"/>
  <circle cx="940" cy="440" r="240" fill="#FFFFFF" fill-opacity="0.10"/>
  <circle cx="820" cy="60" r="80" fill="#FFFFFF" fill-opacity="0.12"/>
  <!-- App icon tile -->
  <rect x="60" y="150" width="200" height="200" rx="48" fill="#FFFFFF"/>
  <text x="160" y="295" text-anchor="middle" font-size="130" font-weight="800" fill="url(#brand)" font-family="-apple-system, system-ui, Roboto">${escapeSvg(monogram)}</text>
  <!-- Wordmark + tagline -->
  <text x="300" y="220" font-size="84" font-weight="800" fill="#FFFFFF" font-family="-apple-system, system-ui, Roboto">${escapeSvg(wordmark)}</text>
  <text x="300" y="280" font-size="32" font-weight="500" fill="#F3E8FF" font-family="-apple-system, system-ui, Roboto">${escapeSvg(taglineLines[0])}</text>
  <text x="300" y="320" font-size="32" font-weight="500" fill="#F3E8FF" font-family="-apple-system, system-ui, Roboto">${escapeSvg(taglineLines[1] ?? "")}</text>
  <!-- Pills -->${pillsSvg}
</svg>`;
}

export function generateFeatureGraphic({ outDir = DEFAULT_OUT, tmpDir } = {}) {
  mkdirSync(outDir, { recursive: true });
  const tmp = tmpDir ?? mkdtempSync(join(tmpdir(), "edunav-play-extras-"));
  const svgPath = join(tmp, "feature-graphic.svg");
  const pngPath = join(outDir, "feature-graphic.png");
  writeFileSync(svgPath, featureGraphicSVG());
  // PNG24: forces a 24-bit PNG (no alpha channel) which is what the Play
  // Console expects for the feature graphic. -alpha remove flattens any
  // transparency over the brand-color background first.
  execFileSync("magick", [
    "-background", COL.primary,
    "-density", "300",
    svgPath,
    "-resize", "1024x500!",
    "-alpha", "remove",
    "-alpha", "off",
    "-strip",
    `PNG24:${pngPath}`,
  ], { stdio: ["ignore", "ignore", "inherit"] });
  return pngPath;
}

export function generateIcon512({
  outDir = DEFAULT_OUT,
  iconSrc = DEFAULT_ICON_SRC,
} = {}) {
  mkdirSync(outDir, { recursive: true });
  const pngPath = join(outDir, "icon-512.png");
  // Flatten over white so any transparent pixels in icon.png become opaque,
  // then PNG24: forces 24-bit RGB output — Play Console rejects icons that
  // still carry an alpha channel.
  execFileSync("magick", [
    iconSrc,
    "-resize", "512x512",
    "-background", "white",
    "-alpha", "remove",
    "-alpha", "off",
    "-strip",
    `PNG24:${pngPath}`,
  ], { stdio: ["ignore", "ignore", "inherit"] });
  return pngPath;
}

function main() {
  const fg = generateFeatureGraphic();
  console.log(`  Android: ${fg}`);
  const icon = generateIcon512();
  console.log(`  Android: ${icon}`);
  console.log("\nPlay Store extras generated.");
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main();
}
