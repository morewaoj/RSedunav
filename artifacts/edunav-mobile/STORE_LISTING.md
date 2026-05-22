# EduNav Mobile — App Store & Google Play Listing

This document captures the metadata, assets, and release checklist for publishing
RS EduNav to the iOS App Store and Google Play Store. Use it as the single
source of truth when filling in App Store Connect and the Play Console.

---

## Identifiers

| Field | Value |
| --- | --- |
| App name | RS EduNav |
| iOS bundle ID | `com.rseducation.edunav` |
| Android package | `com.rseducation.edunav` |
| URL scheme | `edunav-mobile` |
| Initial version | 1.0.0 |
| Initial iOS build number | 1 |
| Initial Android version code | 1 |

The version, buildNumber, and versionCode auto-increment on production builds
(see `eas.json`). Do not bump them manually.

---

## Short description (Google Play, 80 chars max)

> AI-powered guidance for college, careers, and scholarships — all in one place.

## Full description (App Store / Play Store, 4000 chars max)

RS EduNav is the AI-powered companion for students planning their next step.
Whether you're choosing a major, exploring careers, or hunting for scholarships,
EduNav turns the overwhelming world of education into a personalized roadmap.

WHAT YOU CAN DO
- Get matched to careers based on your interests, skills, and education.
- Discover colleges that fit your goals, with ratings, programs, and key stats.
- Find scholarships you actually qualify for, save them, and track deadlines.
- Upload your resume to refresh recommendations with one tap.
- Build a personal plan ("My Plan") of saved careers, schools, and awards.
- See real wage and job-market data for the careers you're considering.

WHO IT'S FOR
- High-school students starting their college search.
- College students refining a major or planning their career.
- Parents and counselors helping a student think through their options.

WHY EDUNAV
- Personalized — recommendations adapt as your profile evolves.
- Honest — soft labels like "Top match" instead of meaningless percentages.
- Private — your data stays yours, used only to improve your recommendations.

Sign up free and start planning your future today.

## Keywords (App Store, 100 chars max, comma-separated)

> college,career,scholarship,student,education,major,university,planner,resume,jobs

## Categories

- **iOS primary:** Education
- **iOS secondary:** Reference
- **Android:** Education

## Content rating

- **Age rating:** 4+ (iOS) / Everyone (Android)
- No user-generated content shared publicly, no ads, no in-app purchases yet.

## Support & legal links

The four pages below are served from the EduNav web artifact (`artifacts/edunav`).
If you publish the web app under a different hostname, update this section to
match the new origin.

- **Support URL:** https://rsedunav.com/support
- **Marketing URL:** https://rsedunav.com/welcome
- **Privacy policy URL:** https://rsedunav.com/privacy
- **Terms URL:** https://rsedunav.com/terms

## Data safety / privacy disclosures

Declare to both stores:
- **Account data:** email, name (used for sign-in; stored on our backend).
- **App activity:** saved items, recommendation interactions (used to personalize).
- **Files & docs:** resume uploads (parsed to extract skills; user-initiated).
- **Photos:** profile picture (user-initiated upload only).
- **Not collected:** location, contacts, advertising IDs, financial info.
- **Encryption:** data encrypted in transit (HTTPS).
- **Deletion:** users can delete their account from in-app settings.

---

## Required visual assets

Generate the following before submitting. The base icon at
`assets/images/icon.png` is 1024×1024 (App Store ready).

### iOS App Store
- App icon: 1024×1024 PNG (no alpha) — already shipped.
- iPhone 6.7" screenshots: 1290×2796 (3 minimum, 10 max).
- iPhone 6.5" screenshots: 1242×2688 (3 minimum, 10 max).
- iPhone 5.5" screenshots: 1242×2208 (only required for iPhone 8 Plus support; skip if min iOS is set high enough).

### Google Play
- Adaptive icon: foreground 432×432 (already shipped via `android.adaptiveIcon`).
- Hi-res icon: 512×512 PNG (re-export from `icon.png`).
- Feature graphic: 1024×500 PNG.
- Phone screenshots: 1080×1920 or larger (2 minimum, 8 max).

### Recommended screenshots (capture in this order)
1. Home / "For You" — recommendations populated.
2. Career match results — show "Top match" labels.
3. Scholarship list with filters applied.
4. Scholarship detail with save button.
5. College detail page with stats.
6. My Plan — saved items grouped.
7. Profile with resume upload CTA.

Save them under `artifacts/edunav-mobile/assets/store/` (create folder when ready).

### Screenshot capture pipeline

The committed screenshots in `assets/store/{ios,android}/` are 1:1 captures
of the app running in **demo mode** on a real iOS simulator and Android
emulator. There are three ways to refresh them, in order of preference:

#### A) GitHub Actions (preferred, no Mac needed)

`.github/workflows/store-screenshots.yml` runs on a `macos-14` GitHub-hosted
runner. It builds a simulator-target IPA + an emulator APK using the
`screenshots` profile in `eas.json` (which bakes `EXPO_PUBLIC_DEMO=1` into
the bundle), boots an iPhone 15 Pro Max simulator + a Pixel 6 / API 34
emulator, installs the apps, and invokes
`scripts/store-screens/capture-simulator.mjs` to drive each app through the
seven store-critical routes via deep links and capture each screen.

To refresh:

1. From the **Actions** tab, run **Store screenshots (mobile)** (manual
   dispatch). Optionally override the iOS device name.
2. After ~30–45 min, download the `store-screenshots-ios` and
   `store-screenshots-android` artifacts.
3. Unzip into `artifacts/edunav-mobile/assets/store/{ios,android}/`,
   commit the changed PNGs, and open a PR.

The workflow needs an `EXPO_TOKEN` repo secret so `eas build --local` can
prebuild without an interactive login.

#### B) Local macOS

Requires Xcode (full install), Android Studio with an emulator image,
ImageMagick (`brew install imagemagick`), and `npx eas-cli login`. Step-by-
step commands live in `scripts/store-screens/README.md`. The same
`capture-simulator.mjs` orchestrator is used.

#### C) SVG fallback

`scripts/store-screens/generate.mjs` paints the same layout as SVG and
ships ImageMagick PNGs at the exact store dimensions. Use only when the
simulator path is unavailable (e.g. emergency listing fix from a non-Mac).

### Routes captured

Both platforms produce the same filenames so the new PNGs replace existing
ones in place:

| # | Deep link | iOS file | Android file |
| --- | --- | --- | --- |
| 1 | `edunav-mobile:///` | `ios/01-home.png` | `android/01-home.png` |
| 2 | `edunav-mobile:///careers` | `ios/02-career-match.png` | `android/02-career-match.png` |
| 3 | `edunav-mobile:///scholarships` | `ios/03-scholarships.png` | `android/03-scholarships.png` |
| 4 | `edunav-mobile:///scholarship/1` | `ios/04-scholarship-detail.png` | `android/04-scholarship-detail.png` |
| 5 | `edunav-mobile:///college/stanford` | `ios/05-college-detail.png` | `android/05-college-detail.png` |
| 6 | `edunav-mobile:///saved` | `ios/06-my-plan.png` | `android/06-my-plan.png` |
| 7 | `edunav-mobile:///profile` | `ios/07-profile.png` | `android/07-profile.png` |

The 1024×500 Play Store feature graphic (`android/feature-graphic.png`) and
the 512×512 hi-res icon (`android/icon-512.png`) are not screen captures —
preserve them when re-running the pipeline.

---

## Pre-flight checklist

Before kicking off a production build:

- [x] `EXPO_PUBLIC_API_URL` in `eas.json` (preview + production) points at the live API host (`https://rsedunav.com`).
- [x] The deployed API CORS allowlist accepts the production web origin (`https://rsedunav.com`), Replit dev/preview domains, and no-Origin native mobile fetches (`artifacts/api-server/src/app.ts`).
- [ ] `extra.eas.projectId` in `app.json` is populated (run `eas init` to fill it in).
- [ ] Bundle identifier and Android package match what's registered in App Store Connect / Play Console.
- [ ] All four legal URLs above resolve.
- [ ] Privacy / data-safety form is completed in both consoles.
- [ ] Screenshots and icons listed above are uploaded.
- [ ] `pnpm --filter @workspace/edunav-mobile typecheck` passes.
- [ ] **Demo mode is OFF for production builds.** `EXPO_PUBLIC_DEMO` must
      be unset (or `0`) in the `production` profile of `eas.json`. Demo
      mode is intended only for capturing store screenshots from the local
      Expo web build; the `?demo=1` URL toggle has no effect in the native
      app bundle and only acts on the web target, but the env-var path
      affects native too — keep it cleared in `production`.

---

## Build & submit commands

Run from `artifacts/edunav-mobile/`. You must be logged in to EAS
(`npx eas-cli login`) and have created the project (`npx eas-cli init`).

```bash
# One-time: link this project to an EAS project (writes extra.eas.projectId)
npx eas-cli init

# Internal preview build (TestFlight / Play Internal Testing)
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform android --profile preview

# Production build (App Store / Play Store)
npx eas-cli build --platform ios --profile production
npx eas-cli build --platform android --profile production

# Submit the latest production build
npx eas-cli submit --platform ios --profile production
npx eas-cli submit --platform android --profile production
```

For Android submission, drop the Google Play service-account JSON at
`artifacts/edunav-mobile/play-store-service-account.json` (it's gitignored — do
not commit it).

---

## Release notes template (1.0.0)

> Welcome to RS EduNav! Discover careers that match your strengths, find
> scholarships you qualify for, and build a personal college plan — all powered
> by AI.
