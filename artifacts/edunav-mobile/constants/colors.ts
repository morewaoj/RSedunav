/**
 * RS EduNav design tokens — mirrors the web app's brand:
 * white background, premium SaaS aesthetic, purple gradient (#6C2BD9 → #A855F7).
 * No blue. Border radius 12px to match --radius: 0.75rem on web.
 */

const colors = {
  light: {
    text: "#0F172A",
    tint: "#6C2BD9",

    background: "#FFFFFF",
    foreground: "#0F172A",

    card: "#FFFFFF",
    cardForeground: "#0F172A",

    primary: "#6C2BD9",
    primaryEnd: "#A855F7",
    primaryForeground: "#FFFFFF",

    secondary: "#F1F5F9",
    secondaryForeground: "#0F172A",

    muted: "#F8FAFC",
    mutedForeground: "#64748B",

    accent: "#F3E8FF",
    accentForeground: "#6C2BD9",

    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",

    border: "#E2E8F0",
    input: "#E2E8F0",
  },
  radius: 12,
};

export default colors;
