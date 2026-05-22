// Shared brand constants for the store-screens pipeline.
//
// Both `generate.mjs` (phone screenshots) and `generate-play-extras.mjs`
// (Play Store feature graphic + 512×512 icon) import from this module, so
// when branding changes — primary color, wordmark, tagline — every Play
// Store asset stays in sync on the next refresh.

export const COL = {
  bg: "#FFFFFF",
  fg: "#0F172A",
  muted: "#64748B",
  mutedBg: "#F8FAFC",
  border: "#E2E8F0",
  primary: "#6C2BD9",
  primaryEnd: "#A855F7",
  accent: "#F3E8FF",
  accentFg: "#6C2BD9",
  card: "#FFFFFF",
  green: "#10B981",
  greenBg: "#ECFDF5",
  amber: "#F59E0B",
  amberBg: "#FEF3C7",
  rose: "#F43F5E",
};

// Marketing copy used on the 1024×500 Play Store feature graphic.
export const FEATURE_GRAPHIC = {
  wordmark: "RS EduNav",
  monogram: "E",
  taglineLines: [
    "AI guidance for college, careers",
    "& scholarships — all in one place.",
  ],
  pills: ["Careers", "Colleges", "Scholarships"],
};

// Two-line marketing taglines overlaid on each phone screenshot, keyed by
// the screen name in `generate.mjs`. Edit here to update both the iOS and
// Android screenshots on the next refresh.
export const SCREEN_TAGLINES = {
  "01-home": ["Your AI companion", "for every next step"],
  "02-career-match": ["Discover careers", "that fit your strengths"],
  "03-scholarships": ["Find scholarships", "you actually qualify for"],
  "04-scholarship-detail": ["See exactly why", "each award fits you"],
  "05-college-detail": ["Compare colleges", "with the stats that matter"],
  "06-my-plan": ["Build a personal plan", "as you explore"],
  "07-profile": ["Upload your resume,", "watch matches improve"],
};
