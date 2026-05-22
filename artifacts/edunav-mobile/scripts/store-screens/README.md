# Store screenshots

Two ways to refresh the PNGs in `assets/store/{ios,android}/`. Pick the one
that matches your environment.

## Option A — CI (GitHub Actions, recommended)

A macOS GitHub-hosted runner has Xcode + the Android emulator preinstalled,
so no developer machine is required.

The workflow also fires automatically on a `schedule:` trigger at 07:00 UTC
on the 1st of every month, so a fresh **"Refresh store screenshots"** PR
shows up monthly without anyone clicking **Run workflow**. Scheduled runs
have no `inputs.*`, so they fall back to the same default iOS simulator
(`iPhone 15 Pro Max`) as a manual run with no inputs. To kick off an
extra refresh in between scheduled runs:

1. Push your branch.
2. Open the **Actions** tab → **Store screenshots (mobile)** → **Run workflow**.
3. Wait ~30–45 min. Two artifacts (`store-screenshots-ios` and
   `store-screenshots-android`) appear on the run page, and a third
   `open-pr` job runs after both succeed.
4. The `open-pr` job copies the captured PNGs into the repo on a
   `store-screenshots/refresh` branch and opens (or updates) a PR titled
   **"Refresh store screenshots"**. The PR description lists the routes
   captured and links back to the Actions run; the diff is restricted to
   `artifacts/edunav-mobile/assets/store/` so reviewers only see the
   visual changes. Review and merge.

If you'd rather skip the auto-PR (e.g. to inspect a single platform), the
two artifact zips are still attached to the run and can be downloaded and
committed by hand.

The workflow is defined in `.github/workflows/store-screenshots.yml`. It
runs `eas build --local --profile screenshots` to produce a simulator/APK
build with `EXPO_PUBLIC_DEMO=1` baked in, installs it, then invokes
`capture-simulator.mjs` to drive the app through the seven routes.

The `screenshots` profile lives in `eas.json` and only differs from
`preview` in two ways: it builds for the iOS simulator (`simulator: true`)
and it sets `EXPO_PUBLIC_DEMO=1`. **Never use this profile for store
submissions** — demo mode short-circuits real API calls.

## Option B — Local macOS

Requires Xcode (full install, not just Command Line Tools), Android Studio
with an emulator image, ImageMagick (`brew install imagemagick`), and an
EAS account (`npx eas-cli login`).

```bash
# from artifacts/edunav-mobile/

# 1. Build a simulator IPA + APK with demo mode baked in.
npx eas-cli build --platform ios     --profile screenshots --local --output ./build-ios.tar.gz
npx eas-cli build --platform android --profile screenshots --local --output ./build-android.apk

# 2. iOS — boot a 6.7'' simulator, install, capture.
SIM_UDID=$(xcrun simctl list devices available | grep "iPhone 15 Pro Max" | head -n1 | grep -o '[A-F0-9-]\{36\}')
xcrun simctl boot "$SIM_UDID"
open -a Simulator
mkdir -p ./build-ios && tar -xzf ./build-ios.tar.gz -C ./build-ios
xcrun simctl install booted "$(find ./build-ios -name '*.app' | head -n1)"
node scripts/store-screens/capture-simulator.mjs --platform=ios

# 3. Android — boot an emulator (1080x1920+), install, capture.
emulator -avd Pixel_6_API_34 -no-snapshot -no-boot-anim &
adb wait-for-device
adb install -r ./build-android.apk
node scripts/store-screens/capture-simulator.mjs --platform=android

# 4. Verify the set is complete and all PNGs are at the required dimensions.
node scripts/store-screens/verify-screens.mjs --platform=ios
node scripts/store-screens/verify-screens.mjs --platform=android
```

## Option C — Fallback (no simulator available)

`generate.mjs` produces SVG mockups in the same layout. Use it only when
the live simulator path is unavailable (e.g. emergency listing fix from a
non-Mac machine):

```bash
node scripts/store-screens/generate.mjs
```

## Routes captured

The canonical list of routes — filename, deep link, and display order — lives
in [`routes.json`](./routes.json). Edit that file to add, remove, or reorder
a screen and every consumer picks it up automatically:

- `capture-simulator.mjs` (what actually gets captured on the simulator/emulator)
- `verify-screens.mjs` (asserts the captured set is complete and correctly sized)
- `generate.mjs` (the SVG-mockup fallback when no simulator is available)
- The `open-pr` job in `.github/workflows/store-screenshots.yml` (the
  Before/After table reviewers see in the auto-PR body)

Both platforms produce the same filenames so they replace existing files in
place. The current set, in order:

| # | Deep link | iOS file | Android file |
| --- | --- | --- | --- |
| 1 | `edunav-mobile:///` | `01-home.png` | `01-home.png` |
| 2 | `edunav-mobile:///careers` | `02-career-match.png` | `02-career-match.png` |
| 3 | `edunav-mobile:///scholarships` | `03-scholarships.png` | `03-scholarships.png` |
| 4 | `edunav-mobile:///scholarship/1` | `04-scholarship-detail.png` | `04-scholarship-detail.png` |
| 5 | `edunav-mobile:///college/stanford` | `05-college-detail.png` | `05-college-detail.png` |
| 6 | `edunav-mobile:///saved` | `06-my-plan.png` | `06-my-plan.png` |
| 7 | `edunav-mobile:///profile` | `07-profile.png` | `07-profile.png` |

> Adding a new screen? Append it to `routes.json` **and** add a matching
> builder in `BUILDERS` inside `generate.mjs` (the renderer throws otherwise),
> a tagline entry in `SCREEN_TAGLINES` inside `brand.mjs`, and a row in the
> table above so this README stays human-readable.

## Play Store extras

The two non-screenshot Play assets — `android/feature-graphic.png` (1024×500)
and `android/icon-512.png` — are regenerated by
`scripts/store-screens/generate-play-extras.mjs`, which reads the brand color
palette and tagline from `scripts/store-screens/brand.mjs` and resizes the
canonical icon at `assets/images/icon.png`. Both PNGs are produced as
24-bit RGB (no alpha), matching Play Console requirements.

The CI workflow runs this script automatically on the Android job, so the
auto-PR refreshes all three asset types in lockstep. Run it locally with:

```bash
node scripts/store-screens/generate-play-extras.mjs
```
