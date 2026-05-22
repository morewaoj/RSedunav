# EduNav Workspace

## Overview
EduNav is an AI-powered educational guidance platform designed to assist students in navigating their academic and career paths. It leverages AI to personalize recommendations, helping users discover suitable colleges, explore career opportunities, and identify relevant scholarships. The platform aims to provide comprehensive support for students making critical life decisions and streamline the search process.

## User Preferences
- I want iterative development.
- I want to be asked before you make any major changes.
- Provide detailed explanations for complex solutions.
- Do not make changes to the folder `lib/db/`.
- Do not make changes to the file `artifacts/edunav/src/lib/queryClient.ts`.
- Focus on using TypeScript for all new code.
- Ensure all new features are thoroughly tested.

## System Architecture
EduNav is built as a pnpm monorepo using TypeScript, incorporating web and mobile clients, and a dedicated API backend.

**UI/UX Decisions:**
- **Web Frontend:** React 18 with Vite, Tailwind CSS v3, and shadcn/ui.
- **Mobile App:** Expo / React Native with Expo Router.
  - **Branding:** White background with a purple gradient (`#6C2BD9 → #A855F7`), avoiding blue.
  - **Typography:** Uses native system fonts (San Francisco on iOS, Roboto on Android).
  - **Navigation:** Mobile uses file-based routing with bottom tabs. Detail screens hide the native header and render an in-page `ScreenHeader`.
  - **Data Handling:** `For You` data is nested and normalized for display. Saved items deduplicate by user and item identifier. Navigation payloads are JSON-encoded directly to avoid double-encoding issues.
  - **Career Match UX:** Displays soft labels (e.g., "Top match") instead of raw percentages. Inline loader for matching.
  - **Purple usage convention (mobile):** Reserved for primary action buttons, hero sections, selected/active states, and accent highlights. Feature cards and scholarship cards are plain white.

**Technical Implementations:**
- **Monorepo:** Managed with pnpm workspaces.
- **Backend:** Node.js (v24), Express 5, `passport-local` for authentication, `express-session` storing sessions in PostgreSQL.
- **Database:** PostgreSQL with Drizzle ORM.
- **Validation:** Zod v3 and `drizzle-zod`.
- **AI Integration:** Anthropic Claude SDK and OpenAI for features like resume parsing and career matching.
- **Build System:** esbuild for API server bundling.
- **Shared Libraries:** `@workspace/db`, `@workspace/api-spec`, `@workspace/api-client-react`.
- **Career Matching:** Hybrid matcher using strict canonicalization, taxonomy lookup, keyword matching, and fuzzy fallback.
- **College Indexer (legacy):** The in-memory `collegeIndexer` initializes only when `NODE_ENV !== 'production'`. Its 12-minute boot-time load held a Neon connection long enough to be killed and crashed the API server. The `/api/colleges/by-industry`, `/by-state`, `/by-program`, `/comprehensive-search`, and `/industry-stats` endpoints have no client callers and return empty results in production.
- **API Communication:** CORS configured for cross-origin requests with credentials.
- **Mobile Data Handling:** `AsyncStorage` for session IDs and cache; `expo-document-picker` and `expo-image-picker` for uploads.
- **Safety Helpers:** `lib/utils.ts` includes `safeOpenUrl`, `formatValue`, and `isScholarshipOpen`.

**Feature Specifications:**
- **User Authentication:** Local username/password with session management.
- **Career Matching Flow:** Recommends careers based on user input (interests, skills, education).
- **Profile Management:** Edit personal info, upload avatars, upload resumes for analysis, which refreshes recommendations.
- **Scholarship Discovery:** Search, filter, sort, and save scholarships with detailed views.
- **College Details:** Comprehensive college information including ratings, stats, programs.
- **Job Market Analysis:** Insights into career wages and trends.
- **Saved Items (My Plan):** Save and manage careers, colleges, and scholarships.
- **Resume Analysis:** Extracts skills and keywords for personalized recommendations.

## External Dependencies
- **Database:** PostgreSQL (Drizzle ORM)
- **AI Services:** Anthropic Claude SDK, OpenAI
- **Frontend Framework:** React 18
- **UI Libraries:** Tailwind CSS v3, shadcn/ui
- **Mobile Framework:** Expo / React Native
- **API Framework:** Express 5
- **Authentication:** passport-local, express-session, connect-pg-simple
- **HTTP Client:** React Query
- **Validation Library:** Zod v3, drizzle-zod
- **Database Connector:** @neondatabase/serverless, ws
- **Mobile Pickers:** expo-document-picker, expo-image-picker
- **Navigation (Mobile):** Expo Router
- **State Management (Mobile):** AsyncStorage

## Mobile Store Release (iOS App Store + Google Play)
- **Identifiers:** iOS bundle `com.rseducation.edunav`, Android package `com.rseducation.edunav` — set in `artifacts/edunav-mobile/app.json`. Change both before submitting under a different developer account.
- **Build tool:** EAS Build (`artifacts/edunav-mobile/eas.json`). Profiles: `development` (dev client), `preview` (internal distribution: TestFlight + Play Internal), `production` (App Store + Play Store, auto-increments buildNumber/versionCode).
- **API URL:** Production builds read `EXPO_PUBLIC_API_URL` (full https URL) — set in `eas.json` per profile (currently `https://rsedunav.com`, the deployed host). Dev workflow continues to use `EXPO_PUBLIC_DOMAIN`.
- **Android assets:** Adaptive icon configured (`android.adaptiveIcon`); release builds produce an `.aab` (`buildType: app-bundle`). Preview builds produce APKs for sideload testing.
- **Splash screen:** Configured via the `expo-splash-screen` plugin (white background, centered icon at 220 px).
- **Permissions declared:** iOS — `NSPhotoLibraryUsageDescription` (avatar), `NSDocumentsFolderUsageDescription` (resume), `ITSAppUsesNonExemptEncryption: false`. Android — `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`.
- **Store metadata:** Descriptions, keywords, screenshots checklist, and pre-flight steps live in `artifacts/edunav-mobile/STORE_LISTING.md`.
- **Build commands** (run from `artifacts/edunav-mobile/`):
  - One-time: `npx eas-cli login && npx eas-cli init` (populates `extra.eas.projectId`).
  - Internal preview: `npx eas-cli build --platform ios --profile preview` / `--platform android --profile preview`.
  - Production: `npx eas-cli build --platform ios --profile production` / `--platform android --profile production`.
- **Submit commands:** `npx eas-cli submit --platform ios --profile production` / `--platform android --profile production`. Drop the Play service-account JSON at `artifacts/edunav-mobile/play-store-service-account.json` (gitignored).