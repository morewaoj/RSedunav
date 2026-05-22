import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { SavedBadge } from "@/components/SavedBadge";
import { SectionHeader } from "@/components/SectionHeader";
import { useRefreshSet } from "@/hooks/useAutoRefreshOnFocus";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { fitLabel, isScholarshipOpen } from "@/lib/utils";
import { SYSTEM_FONT } from "@/lib/typography";

type ProfileSummary = {
  firstName?: string | null;
  major?: string | null;
  state?: string | null;
  interests?: string[] | null;
  resumeFileName?: string | null;
};

// /api/profile/career-recommendations payload shape — saved resume analysis.
// Each entry wraps the full career under `.career`; salary may be number OR
// string (e.g. "$65,000"); `score` is 0-100.
type CareerRecEntry = {
  career?: {
    title?: string;
    description?: string | null;
    averageSalary?: number | string | null;
    onetCode?: string | null;
    growthOutlook?: string | null;
    requiredSkills?: string[] | null;
    keySkills?: string[] | null;
    educationRequired?: string | null;
    matchScore?: number | null;
    // Saved analysis stores reasons joined as `matchReason` (string with
    // `; ` separators); some pipelines also expose the raw `matchReasons`
    // array. We accept either shape.
    matchReason?: string | null;
    matchReasons?: string[] | null;
  } | null;
  score?: number;
  matchScore?: number;
  reason?: string | null;
  matchReasons?: string[] | null;
};

type CareerRecsResponse = {
  careers?: CareerRecEntry[];
  analysisDate?: string;
  needsAnalysis?: boolean;
  message?: string;
};

// /api/profile/scholarship-recommendations payload — smart matcher results.
type ScholarshipRecEntry = {
  scholarship?: {
    id?: string | number | null;
    scholarshipId?: string | number | null;
    name?: string;
    amount?: number | null;
    provider?: string | null;
    website?: string | null;
    description?: string | null;
    type?: string | null;
    deadline?: string | null;
    deadlineAt?: string | null;
    isActive?: boolean | null;
    eligibilityRequirements?: string[] | null;
    targetDemographics?: string[] | null;
    fields?: string[] | null;
    minGpa?: number | null;
    renewable?: boolean | null;
  } | null;
  score?: number;
  matchReasons?: string[];
};

type ScholarshipRecsResponse = {
  recommendations?: ScholarshipRecEntry[];
  totalMatches?: number;
};

// Saved-items rows we care about for matching. Each list stores enough of
// the saved row to drive the "Saved" badge on the For-You cards. Other
// fields exist on the wire but are intentionally omitted.
type SavedCareerRow = {
  careerTitle?: string | null;
  title?: string | null;
  name?: string | null;
};
type SavedCollegeRow = {
  collegeId?: number | string | null;
  id?: number | string | null;
};
type SavedScholarshipRow = {
  scholarshipId?: number | string | null;
  id?: number | string | null;
  scholarshipName?: string | null;
  name?: string | null;
};
type SavedItems = {
  careers?: SavedCareerRow[];
  colleges?: SavedCollegeRow[];
  scholarships?: SavedScholarshipRow[];
};

const FEATURES: {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  href: string;
}[] = [
  {
    title: "Career Match",
    subtitle: "AI-ranked careers from your skills",
    icon: "target",
    href: "/(tabs)/careers",
  },
  {
    title: "Colleges",
    subtitle: "Search U.S. colleges & scholarships",
    icon: "book-open",
    href: "/(tabs)/colleges",
  },
  {
    title: "Scholarships",
    subtitle: "Find awards you actually qualify for",
    icon: "award",
    href: "/(tabs)/scholarships",
  },
  {
    title: "Job Market",
    subtitle: "Live BLS wages & employment trends",
    icon: "trending-up",
    href: "/job-market",
  },
  {
    title: "My Plan",
    subtitle: "Saved careers, colleges & awards",
    icon: "bookmark",
    href: "/saved",
  },
];

// Pulls match-reason chips from a recommendation entry. The scholarship
// matcher gives us a clean `string[]`; the saved career analysis often
// joins them into a `; `-separated string. We normalize, strip empties
// and trim long phrases so chips stay one short line each.
function pickMatchReasons(
  candidates: Array<string[] | string | null | undefined>,
  max = 2,
): string[] {
  for (const candidate of candidates) {
    let parts: string[] = [];
    if (Array.isArray(candidate)) {
      parts = candidate.filter((r): r is string => typeof r === "string");
    } else if (typeof candidate === "string") {
      parts = candidate.split(/;|\u2022|\|/);
    }
    const cleaned = parts
      .map((r) => r.replace(/\s+/g, " ").trim())
      .filter((r) => r.length > 0);
    if (cleaned.length > 0) {
      return cleaned.slice(0, max);
    }
  }
  return [];
}

// Build a normalized lookup key from any candidate string. Used to compare
// saved career titles / scholarship names (where the only stable identifier
// across the recommendations and saved-items APIs is the name itself).
function normalizeKey(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

// Saved analysis stores averageSalary as either a raw number ("65000") or a
// pre-formatted string ("$65,000"). Coerce to a number so we can render
// "$65k median" consistently.
function coerceSalary(raw: number | string | null | undefined): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const digits = raw.replace(/[^0-9.]/g, "");
    const parsed = Number(digits);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export default function HomeTab() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const profileQ = useQuery<ProfileSummary | null>({
    queryKey: ["/api/profile"],
    queryFn: async () => apiGet<ProfileSummary | null>("/api/profile", { allowUnauthorized: true }),
  });

  // Personalized careers come from the saved resume analysis.
  const careersQ = useQuery<CareerRecsResponse | null>({
    queryKey: ["/api/profile/career-recommendations"],
    queryFn: async () =>
      apiGet<CareerRecsResponse | null>("/api/profile/career-recommendations", {
        allowUnauthorized: true,
      }),
  });

  // Personalized scholarships come from the smart matcher (profile-driven —
  // no resume required).
  const scholarshipsQ = useQuery<ScholarshipRecsResponse | null>({
    queryKey: ["/api/profile/scholarship-recommendations"],
    queryFn: async () =>
      apiGet<ScholarshipRecsResponse | null>(
        "/api/profile/scholarship-recommendations",
        { allowUnauthorized: true },
      ),
  });

  const savedQ = useQuery<SavedItems | null>({
    queryKey: ["/api/saved-items", user?.id],
    queryFn: async () =>
      user?.id
        ? apiGet<SavedItems | null>(`/api/saved-items/${encodeURIComponent(user.id)}`, {
            allowUnauthorized: true,
          })
        : null,
    enabled: !!user?.id,
  });

  // Pull-to-refresh: re-fetch every recommendation source in parallel so the
  // user can force a fresh read after editing their resume on the web or
  // when a new scholarship lands in the catalog. We track our own refreshing
  // state (via the helper hook) so the spinner doesn't flicker if React
  // Query reports each query's isFetching independently. The same helper
  // also silently refetches when the tab regains focus or the app returns
  // from background, and stamps the dedupe window so an immediate focus
  // right after a manual pull doesn't trigger an extra silent refetch.
  const refetchAll = useCallback(
    () =>
      Promise.all([
        profileQ.refetch(),
        careersQ.refetch(),
        scholarshipsQ.refetch(),
        user?.id ? savedQ.refetch() : Promise.resolve(),
      ]),
    [profileQ, careersQ, scholarshipsQ, savedQ, user?.id],
  );

  const { refresh: onRefresh, isRefreshing } = useRefreshSet(refetchAll);

  const firstName =
    profileQ.data?.firstName?.trim() || user?.firstName?.trim() || user?.username || "";

  const careers = (careersQ.data?.careers ?? [])
    .map((entry) => {
      const c = entry.career ?? {};
      return {
        title: (c.title ?? "").trim(),
        description: c.description ?? "",
        averageSalary: coerceSalary(c.averageSalary),
        onetCode: c.onetCode ?? null,
        growthOutlook: c.growthOutlook ?? null,
        requiredSkills:
          c.requiredSkills ?? c.keySkills ?? null,
        educationRequired: c.educationRequired ?? null,
        // Score is 0-100 in this endpoint; fallback to legacy matchScore.
        matchScore:
          typeof entry.score === "number"
            ? entry.score
            : typeof entry.matchScore === "number"
              ? entry.matchScore
              : typeof c.matchScore === "number"
                ? c.matchScore
                : null,
        matchReasons: pickMatchReasons([
          entry.matchReasons,
          c.matchReasons,
          entry.reason,
          c.matchReason,
        ]),
      };
    })
    .filter((c) => c.title.length > 0);

  const scholarships = (scholarshipsQ.data?.recommendations ?? [])
    .map((entry) => {
      const s = entry.scholarship ?? {};
      return {
        id: s.id ?? s.scholarshipId ?? null,
        name: (s.name ?? "").trim(),
        provider: s.provider ?? null,
        amount: typeof s.amount === "number" ? s.amount : null,
        website: s.website ?? null,
        deadline: s.deadline ?? null,
        deadlineAt: s.deadlineAt ?? null,
        isActive: s.isActive ?? null,
        description: s.description ?? null,
        type: s.type ?? null,
        eligibilityRequirements: s.eligibilityRequirements ?? null,
        targetDemographics: s.targetDemographics ?? null,
        renewable: s.renewable ?? null,
        matchScore: entry.score ?? null,
        matchReasons: entry.matchReasons ?? null,
        chipReasons: pickMatchReasons([entry.matchReasons]),
      };
    })
    .filter((s) => s.name.length > 0)
    .filter(isScholarshipOpen);

  const profileNeedsWork =
    !profileQ.data?.major ||
    !profileQ.data?.state ||
    (profileQ.data?.interests?.length ?? 0) === 0;
  const hasResume = !!profileQ.data?.resumeFileName;

  const savedCount =
    (savedQ.data?.careers?.length ?? 0) +
    (savedQ.data?.colleges?.length ?? 0) +
    (savedQ.data?.scholarships?.length ?? 0);

  // Lookup sets so the For-You cards can show a "Saved" badge in sync with
  // the same /api/saved-items query the detail screens already use. Career
  // saves are keyed by the title (no PK on saved_careers), and scholarship
  // saves are keyed by both id and name so curated/hardcoded recommendations
  // (which often lack a DB id) still light up.
  const savedCareerTitles = useMemo(() => {
    const set = new Set<string>();
    for (const row of savedQ.data?.careers ?? []) {
      const key = normalizeKey(row.careerTitle ?? row.title ?? row.name);
      if (key) set.add(key);
    }
    return set;
  }, [savedQ.data]);

  const savedScholarshipKeys = useMemo(() => {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const row of savedQ.data?.scholarships ?? []) {
      const id = row.scholarshipId ?? row.id;
      if (id != null) ids.add(String(id));
      const name = normalizeKey(row.scholarshipName ?? row.name);
      if (name) names.add(name);
    }
    return { ids, names };
  }, [savedQ.data]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        {/* Hero */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          <LinearGradient
            colors={[colors.primary, colors.primaryEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { borderRadius: colors.radius + 6 }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="zap" size={12} color="#FFFFFF" />
              <Text style={styles.heroEyebrow}>EduNav</Text>
            </View>
            <Text style={styles.heroTitle}>
              {firstName ? `Welcome, ${firstName}` : "Welcome back"}
            </Text>
            <Text style={styles.heroSubtitle}>
              Your AI-powered guide to colleges, careers and scholarships.
            </Text>

            <View style={styles.heroStatsRow}>
              <HeroStat value={String(careers.length)} label="Career matches" />
              <HeroDivider />
              <HeroStat
                value={String(scholarshipsQ.data?.totalMatches ?? scholarships.length)}
                label="Scholarships"
              />
              <HeroDivider />
              <HeroStat value={String(savedCount)} label="Saved" />
            </View>
          </LinearGradient>
        </View>

        {/* Profile nudge banner — only if essentials missing */}
        {profileNeedsWork ? (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <Pressable
              onPress={() => router.push("/(tabs)/profile")}
              style={({ pressed }) => [
                styles.banner,
                {
                  backgroundColor: colors.accent,
                  borderColor: colors.primary,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={[styles.bannerIcon, { backgroundColor: colors.primary }]}>
                <Feather name="user-check" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: SYSTEM_FONT, fontWeight: "700",
                    fontSize: 14,
                  }}
                >
                  Finish your profile
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: SYSTEM_FONT, fontWeight: "400",
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  Add interests, demographics and a resume to unlock real matches.
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.primary} />
            </Pressable>
          </View>
        ) : null}

        {/* Feature cards */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <SectionHeader title="Explore" subtitle="Your toolbox" />
          <View style={styles.grid}>
            {FEATURES.map((f) => (
              <Pressable
                key={f.title}
                onPress={() => router.push(f.href as never)}
                style={({ pressed }) => [
                  styles.featureCardWrap,
                  {
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.featureCard,
                    {
                      borderRadius: colors.radius,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.featureIconLight,
                      { backgroundColor: colors.accent },
                    ]}
                  >
                    <Feather name={f.icon} size={20} color={colors.primary} />
                  </View>
                  <Text
                    style={[
                      styles.featureTitleDark,
                      { color: colors.foreground },
                    ]}
                  >
                    {f.title}
                  </Text>
                  <Text
                    style={[
                      styles.featureSubDark,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {f.subtitle}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* For You: Careers preview */}
        <View style={{ paddingHorizontal: 20, marginTop: 26 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <View style={{ flex: 1 }}>
              <SectionHeader
                title="Top careers for you"
                subtitle="Personalized from your skills, interests & resume"
              />
            </View>
            {careers.length > 0 ? (
              <Pressable
                onPress={() => router.push("/(tabs)/careers")}
                hitSlop={6}
                style={{ marginBottom: 12, marginLeft: 12 }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: SYSTEM_FONT, fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  See all
                </Text>
              </Pressable>
            ) : null}
          </View>

          {careersQ.isLoading ? (
            <View style={[styles.center, { paddingVertical: 30 }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : careers.length === 0 ? (
            <Card onPress={() => router.push("/(tabs)/profile")}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
                  <Feather
                    name={hasResume ? "compass" : "upload"}
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: SYSTEM_FONT, fontWeight: "700",
                      fontSize: 14,
                    }}
                  >
                    {hasResume
                      ? "Run your first match"
                      : "Upload your resume to unlock matches"}
                  </Text>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: SYSTEM_FONT, fontWeight: "400",
                      fontSize: 12,
                      marginTop: 2,
                      lineHeight: 17,
                    }}
                  >
                    {hasResume
                      ? "Tell us your interests and skills to see ranked careers."
                      : "We rank careers from your real skills and experience — takes 30 seconds."}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </View>
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              {careers.slice(0, 3).map((c, idx) => {
                const isSaved = savedCareerTitles.has(normalizeKey(c.title));
                return (
                <Card
                  key={`${c.title}-${idx}`}
                  onPress={() =>
                    router.push({
                      pathname: "/career/[id]",
                      params: {
                        id: c.onetCode || c.title || `home-${idx}`,
                        data: JSON.stringify({
                          career: {
                            title: c.title,
                            description: c.description,
                            averageSalary: c.averageSalary,
                            topKConfidence: c.matchScore,
                            onetCode: c.onetCode,
                            growthOutlook: c.growthOutlook,
                            requiredSkills: c.requiredSkills,
                            educationRequirements: c.educationRequired,
                          },
                        }),
                      },
                    })
                  }
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
                      <Feather name="briefcase" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontFamily: SYSTEM_FONT, fontWeight: "700",
                          fontSize: 14,
                        }}
                        numberOfLines={2}
                      >
                        {c.title}
                      </Text>
                      {typeof c.averageSalary === "number" && c.averageSalary > 0 ? (
                        <Text
                          style={{
                            color: colors.mutedForeground,
                            fontFamily: SYSTEM_FONT, fontWeight: "400",
                            fontSize: 12,
                            marginTop: 2,
                          }}
                        >
                          ${Math.round(c.averageSalary / 1000)}k median
                        </Text>
                      ) : null}
                      <MatchReasonChips reasons={c.matchReasons} />
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      {typeof c.matchScore === "number" ? (
                        <View
                          style={[
                            styles.matchPill,
                            { backgroundColor: colors.accent },
                          ]}
                        >
                          <Text
                            style={{
                              color: colors.primary,
                              fontFamily: SYSTEM_FONT, fontWeight: "700",
                              fontSize: 11,
                            }}
                          >
                            {fitLabel(c.matchScore)}
                          </Text>
                        </View>
                      ) : null}
                      {isSaved ? <SavedBadge /> : null}
                    </View>
                  </View>
                </Card>
                );
              })}
            </View>
          )}
        </View>

        {/* For You: Scholarships preview */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <View style={{ flex: 1 }}>
              <SectionHeader
                title="Scholarships for you"
                subtitle="Targeted to your demographics & need"
              />
            </View>
            {scholarships.length > 0 ? (
              <Pressable
                onPress={() => router.push("/(tabs)/scholarships")}
                hitSlop={6}
                style={{ marginBottom: 12, marginLeft: 12 }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: SYSTEM_FONT, fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  See all
                </Text>
              </Pressable>
            ) : null}
          </View>

          {scholarshipsQ.isLoading ? (
            <View style={[styles.center, { paddingVertical: 30 }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : scholarships.length === 0 ? (
            <Card onPress={() => router.push("/(tabs)/profile")}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
                  <Feather name="user-check" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: SYSTEM_FONT, fontWeight: "700",
                      fontSize: 14,
                    }}
                  >
                    Add your demographics for matches
                  </Text>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: SYSTEM_FONT, fontWeight: "400",
                      fontSize: 12,
                      marginTop: 2,
                      lineHeight: 17,
                    }}
                  >
                    Tell us your major, GPA and demographics to find awards you qualify for.
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </View>
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              {scholarships.slice(0, 3).map((s, idx) => {
                const isSaved =
                  (s.id != null && savedScholarshipKeys.ids.has(String(s.id))) ||
                  savedScholarshipKeys.names.has(normalizeKey(s.name));
                return (
                <Card
                  key={`${s.name}-${idx}`}
                  onPress={() =>
                    router.push({
                      pathname: "/scholarship/[id]",
                      params: {
                        id: s.name,
                        // Pass the full recommendation payload so the
                        // detail screen can render even when the matcher's
                        // hardcoded scholarship isn't in the DB.
                        data: JSON.stringify(s),
                      },
                    } as any)
                  }
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
                      <Feather name="award" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontFamily: SYSTEM_FONT, fontWeight: "700",
                          fontSize: 14,
                        }}
                        numberOfLines={2}
                      >
                        {s.name}
                      </Text>
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontFamily: SYSTEM_FONT, fontWeight: "400",
                          fontSize: 12,
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                      >
                        {s.provider || "Verified"}
                        {typeof s.amount === "number" && s.amount > 0
                          ? `  ·  $${s.amount.toLocaleString()}`
                          : ""}
                      </Text>
                      <MatchReasonChips reasons={s.chipReasons} />
                    </View>
                    {isSaved ? <SavedBadge /> : null}
                  </View>
                </Card>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function MatchReasonChips({ reasons }: { reasons: string[] | null | undefined }) {
  const colors = useColors();
  if (!reasons || reasons.length === 0) return null;
  return (
    <View style={styles.chipRow}>
      {reasons.map((reason, idx) => (
        <View
          key={`${idx}-${reason}`}
          style={[
            styles.reasonChip,
            { backgroundColor: colors.accent, borderColor: colors.border },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[styles.reasonChipText, { color: colors.primary }]}
          >
            {reason}
          </Text>
        </View>
      ))}
    </View>
  );
}

function HeroDivider() {
  return (
    <View
      style={{
        width: 1,
        alignSelf: "stretch",
        backgroundColor: "rgba(255,255,255,0.25)",
        marginVertical: 4,
      }}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 22,
    paddingVertical: 26,
    overflow: "hidden",
  },
  heroEyebrow: {
    color: "#FFFFFF",
    fontFamily: SYSTEM_FONT, fontWeight: "700",
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontFamily: SYSTEM_FONT, fontWeight: "700",
    fontSize: 26,
    letterSpacing: -0.4,
    marginTop: 10,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.92)",
    fontFamily: SYSTEM_FONT, fontWeight: "400",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.18)",
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontFamily: SYSTEM_FONT, fontWeight: "700",
    fontSize: 20,
  },
  heroStatLabel: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: SYSTEM_FONT, fontWeight: "500",
    fontSize: 11,
    marginTop: 2,
    textAlign: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  bannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  featureCardWrap: {
    width: "47%",
    flexGrow: 1,
    overflow: "hidden",
  },
  featureCard: {
    padding: 16,
    minHeight: 140,
  },
  featureIconLight: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitleDark: {
    fontFamily: SYSTEM_FONT,
    fontWeight: "700",
    fontSize: 15,
    marginTop: 14,
  },
  featureSubDark: {
    fontFamily: SYSTEM_FONT,
    fontWeight: "400",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  matchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  reasonChip: {
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reasonChipText: {
    fontFamily: SYSTEM_FONT,
    fontWeight: "600",
    fontSize: 10.5,
    letterSpacing: 0.1,
  },
  center: { alignItems: "center", justifyContent: "center" },
});
