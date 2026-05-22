#!/usr/bin/env node
/**
 * Drive the running EduNav app on an iOS simulator OR Android emulator
 * through every store-screenshot route, capture each screen, and write the
 * resulting PNGs to assets/store/{ios,android}/ at the exact dimensions the
 * App Store / Play Store require.
 *
 * Prerequisites (this script ONLY runs on macOS or a CI macOS runner):
 *   - iOS: Xcode (xcrun simctl available) + an installed simulator build of
 *     the app with EXPO_PUBLIC_DEMO=1 baked in (see the "screenshots" profile
 *     in eas.json). The bundle ID must match com.rseducation.edunav.
 *   - Android: Android SDK platform-tools (adb) + an installed APK of the
 *     "screenshots" build profile + a running emulator.
 *   - ImageMagick (`magick` on PATH) for the final resize/pad pass.
 *
 * Usage:
 *   node scripts/store-screens/capture-simulator.mjs --platform=ios
 *   node scripts/store-screens/capture-simulator.mjs --platform=android
 *   node scripts/store-screens/capture-simulator.mjs --platform=ios --device="iPhone 15 Pro Max"
 *
 * The script does NOT boot the simulator/emulator or install the app — that
 * is handled by the calling workflow (.github/workflows/store-screenshots.yml
 * for CI, or the documented local steps in STORE_LISTING.md). Keeping
 * concerns separate makes both paths easier to debug.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_SCHEME = "edunav-mobile";
const IOS_BUNDLE_ID = "com.rseducation.edunav";
const ANDROID_PACKAGE = "com.rseducation.edunav";

const IOS_TARGET = { width: 1290, height: 2796 };
const ANDROID_TARGET = { width: 1080, height: 1920 };

// Single source of truth for the screenshot route list — see routes.json.
// verify-screens.mjs, generate.mjs, and the open-pr job in
// .github/workflows/store-screenshots.yml all read the same file, so adding
// or reordering a route here automatically updates every consumer.
const ROUTES = JSON.parse(
  readFileSync(join(__dirname, "routes.json"), "utf8"),
);

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (a.startsWith("--")) out[a.slice(2)] = true;
  }
  return out;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")} (exit ${r.status})`);
  }
}

function runCapture(cmd, args) {
  // Variant of run() that returns stdout for screencap on Android.
  const r = spawnSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"] });
  if (r.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")} (exit ${r.status})`);
  }
  return r.stdout;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function ensureMagick() {
  const r = spawnSync("magick", ["-version"], { stdio: "ignore" });
  if (r.status !== 0) {
    throw new Error(
      "ImageMagick (`magick`) is required on PATH for the final resize step.",
    );
  }
}

function resizeToTarget(srcPath, dstPath, target) {
  // Cover-resize then center-crop to exact store dimensions; never upscale
  // beyond the captured pixels — store guidelines accept slight letterboxing
  // but reject mismatched dimensions.
  execFileSync(
    "magick",
    [
      srcPath,
      "-filter",
      "Lanczos",
      "-resize",
      `${target.width}x${target.height}^`,
      "-gravity",
      "center",
      "-extent",
      `${target.width}x${target.height}`,
      "-strip",
      dstPath,
    ],
    { stdio: "inherit" },
  );
}

// ---------- iOS ----------

async function captureIOS(deviceName) {
  const outDir = join(ROOT, "assets", "store", "ios");
  mkdirSync(outDir, { recursive: true });
  const tmp = join(ROOT, ".store-tmp", "ios");
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });

  // Sanity check — simulator must already be booted by the caller.
  execFileSync("xcrun", ["simctl", "list", "devices", "booted"], {
    stdio: "inherit",
  });

  for (const route of ROUTES) {
    const url = `${APP_SCHEME}://${route.path}`;
    console.log(`\n[iOS ${deviceName}] -> ${url}`);
    // Background-and-relaunch trick: terminate first so the deep link is
    // treated as a cold-start route rather than getting eaten by the existing
    // navigation stack.
    spawnSync("xcrun", ["simctl", "terminate", "booted", IOS_BUNDLE_ID], {
      stdio: "ignore",
    });
    await sleep(500);
    run("xcrun", ["simctl", "openurl", "booted", url]);
    await sleep(route.settle);
    const raw = join(tmp, `${route.slug}.png`);
    run("xcrun", ["simctl", "io", "booted", "screenshot", raw]);
    const dst = join(outDir, `${route.slug}.png`);
    resizeToTarget(raw, dst, IOS_TARGET);
    console.log(`  wrote ${dst}`);
  }
}

// ---------- Android ----------

function adb(args) {
  return run("adb", args);
}

async function captureAndroid() {
  const outDir = join(ROOT, "assets", "store", "android");
  mkdirSync(outDir, { recursive: true });
  const tmp = join(ROOT, ".store-tmp", "android");
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });

  // Sanity check — emulator must already be online.
  execFileSync("adb", ["wait-for-device"], { stdio: "inherit" });
  execFileSync("adb", ["devices"], { stdio: "inherit" });

  for (const route of ROUTES) {
    const url = `${APP_SCHEME}://${route.path}`;
    console.log(`\n[Android] -> ${url}`);
    adb(["shell", "am", "force-stop", ANDROID_PACKAGE]);
    await sleep(500);
    adb([
      "shell",
      "am",
      "start",
      "-W",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      url,
      ANDROID_PACKAGE,
    ]);
    await sleep(route.settle);
    const raw = join(tmp, `${route.slug}.png`);
    // adb exec-out preserves binary stdout — write directly to disk.
    const buf = runCapture("adb", ["exec-out", "screencap", "-p"]);
    if (!buf || buf.length === 0) {
      throw new Error(`Empty screencap for ${route.slug}`);
    }
    (await import("node:fs")).writeFileSync(raw, buf);
    const dst = join(outDir, `${route.slug}.png`);
    resizeToTarget(raw, dst, ANDROID_TARGET);
    console.log(`  wrote ${dst}`);
  }
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv);
  const platform = args.platform;
  if (platform !== "ios" && platform !== "android") {
    console.error("Usage: capture-simulator.mjs --platform=ios|android [--device=...]");
    process.exit(2);
  }
  ensureMagick();
  if (platform === "ios") {
    await captureIOS(args.device ?? "iPhone 15 Pro Max");
  } else {
    await captureAndroid();
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
