import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { MultiSelect } from "@/components/MultiSelect";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SavedBadge } from "@/components/SavedBadge";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { ACADEMIC_LEVELS, FALLBACK_INTERESTS, FALLBACK_SKILLS } from "@/constants/profile-options";
import { useRefreshSet } from "@/hooks/useAutoRefreshOnFocus";
import { useColors } from "@/hooks/useColors";
import { apiGet, apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isDemoMode } from "@/lib/demo-data";
import { SYSTEM_FONT } from "@/lib/typography";
import { fitLabel } from "@/lib/utils";

type ProfilePrefill = {
  interests?: string[] | null;
  academicLevel?: string | null;
  resumeAnalysisResults?: { skills?: string[] | null; interests?: string[] | null } | null;
};

type DynamicOption = { name: string };

type CareerMatch = {
  career: {
    title: string;
    description?: string | null;
    requiredSkills?: string[] | null;
    averageSalary?: number | null;
    growthOutlook?: string | null;
    workEnvironment?: string | null;
    educationRequirements?: string | null;
    industryInsights?: string[] | null;
    topKConfidence?: number | null;
    onetCode?: string | null;
    industries?: string[] | null;
  };
  marketData?: {
    demandLevel?: string;
    remoteFriendly?: boolean;
    jobAvailability?: number;
  } | null;
  // The hybrid matcher returns the per-career "why this matches you" reasons
  // here; we surface up to 2 as compact chips on the results card.
  matchDetails?: {
    matchReasons?: string[] | null;
  } | null;
};

// Shape returned by /api/profile/career-recommendations — we only need the
// title (case-insensitive) and onetCode so we can intersect with the
// on-demand match results when the user toggles "Matched to me".
type CareerRecsResponse = {
  careers?: Array<{
    career?: { title?: string | null; onetCode?: string | null } | null;
  }>;
};

// /api/saved-items shape (subset). We only need the careers list and only
// the few fields used to look up "is this saved?" on each results card.
type SavedCareerRow = {
  careerTitle?: string | null;
  title?: string | null;
  name?: string | null;
  onetCode?: string | null;
};
type SavedItemsResponse = {
  careers?: SavedCareerRow[];
};

// Mirrors the home screen helper: trim, drop blanks, and cap to a few short
// pills so cards stay scannable.
function pickMatchReasons(
  reasons: string[] | null | undefined,
  max = 2,
): string[] {
  if (!Array.isArray(reasons)) return [];
  const cleaned = reasons
    .filter((r): r is string => typeof r === "string")
    .map((r) => r.replace(/\s+/g, " ").trim())
    .filter((r) => r.length > 0);
  return cleaned.slice(0, max);
}

type MatchResponse = {
  success?: boolean;
  data?: {
    careerOptions?: CareerMatch[];
    confidence?: number;
    totalFound?: number;
  } | null;
};

const MAX_PICK = 5;

export default function CareersTab() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const [education, setEducation] = useState<string>("undergraduate");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [usedProfilePrefill, setUsedProfilePrefill] = useState(false);
  const prefillAppliedRef = useRef(false);

  const profileQ = useQuery<ProfilePrefill | null>({
    queryKey: ["/api/profile"],
    queryFn: async () => apiGet<ProfilePrefill | null>("/api/profile", { allowUnauthorized: true }),
  });
  const profile = profileQ.data ?? null;
  const profileNeedsWork =
    !profile?.interests || profile.interests.length === 0;

  // Pull the user's saved profile-based career matches so the ResultsView can
  // offer the same "Matched to me" toggle the Scholarships tab has. Allowed
  // to fail quietly (e.g. signed-out users) — results still render, just
  // without the chip.
  const careerRecsQ = useQuery<CareerRecsResponse | null>({
    queryKey: ["/api/profile/career-recommendations"],
    queryFn: async () =>
      apiGet<CareerRecsResponse | null>(
        "/api/profile/career-recommendations",
        { allowUnauthorized: true },
      ),
  });

  // Pull the saved-items list so each results card can show a "Saved" badge
  // when the career is already in the user's plan. Mirrors the same query
  // used by the detail screen so the badge stays in sync with the saved
  // state immediately after any add/remove (cache invalidation already
  // happens there).
  const savedItemsQ = useQuery<SavedItemsResponse | null>({
    queryKey: ["/api/saved-items", user?.id],
    queryFn: async () =>
      user?.id
        ? apiGet<SavedItemsResponse | null>(
            `/api/saved-items/${encodeURIComponent(user.id)}`,
            { allowUnauthorized: true },
          )
        : null,
    enabled: !!user?.id,
  });

  // Lookup sets keyed by both normalized title and onetCode so a results card
  // matches the user's saved careers if either side agrees. Saved careers
  // store the title (the row has no career PK), so title is the primary key
  // here; onetCode is included as a backup for richer pipelines.
  const savedCareerKeys = useMemo(() => {
    const titles = new Set<string>();
    const onetCodes = new Set<string>();
    for (const row of savedItemsQ.data?.careers ?? []) {
      const title = (row.careerTitle ?? row.title ?? row.name ?? "")
        .trim()
        .toLowerCase();
      if (title) titles.add(title);
      const code = row.onetCode?.trim();
      if (code) onetCodes.add(code);
    }
    return { titles, onetCodes };
  }, [savedItemsQ.data]);

  // Lookup sets keyed by both normalized title and onetCode so a result
  // matches if either side agrees. Title is normalized (trim + lowercase)
  // because casing varies across pipelines.
  const recommendedKeys = useMemo(() => {
    const titles = new Set<string>();
    const onetCodes = new Set<string>();
    for (const entry of careerRecsQ.data?.careers ?? []) {
      const title = entry.career?.title?.trim().toLowerCase();
      if (title) titles.add(title);
      const code = entry.career?.onetCode?.trim();
      if (code) onetCodes.add(code);
    }
    return { titles, onetCodes };
  }, [careerRecsQ.data]);

  const hasMatches =
    recommendedKeys.titles.size > 0 || recommendedKeys.onetCodes.size > 0;

  const [matchedOnly, setMatchedOnly] = useState(false);

  // If the user enabled the "Matched to me" filter and then matches go away
  // (e.g. signing out), turn it back off so the list isn't stuck empty.
  useEffect(() => {
    if (matchedOnly && !hasMatches) setMatchedOnly(false);
  }, [matchedOnly, hasMatches]);

  const skillsQ = useQuery<string[]>({
    queryKey: ["/api/dynamic-skills"],
    queryFn: async () => {
      try {
        const res = await apiRequest<unknown>("GET", "/api/dynamic-skills");
        if (Array.isArray(res)) {
          return (res as DynamicOption[])
            .map((r) => r?.name)
            .filter((n): n is string => typeof n === "string" && n.length > 0);
        }
      } catch {
        // fall through to fallback
      }
      return FALLBACK_SKILLS;
    },
  });

  const interestsQ = useQuery<string[]>({
    queryKey: ["/api/dynamic-interests"],
    queryFn: async () => {
      try {
        const res = await apiRequest<unknown>("GET", "/api/dynamic-interests");
        if (Array.isArray(res)) {
          return (res as DynamicOption[])
            .map((r) => r?.name)
            .filter((n): n is string => typeof n === "string" && n.length > 0);
        }
      } catch {
        // fall through
      }
      return FALLBACK_INTERESTS;
    },
  });

  const allInterests = interestsQ.data?.length ? interestsQ.data : FALLBACK_INTERESTS;
  const allSkills = skillsQ.data?.length ? skillsQ.data : FALLBACK_SKILLS;

  // One-shot prefill from profile when both profile and option lists are ready
  useEffect(() => {
    if (prefillAppliedRef.current) return;
    if (!profile) return;
    if (!skillsQ.data?.length && !interestsQ.data?.length && !FALLBACK_INTERESTS.length) return;

    const profileInterests = (profile.interests ?? []).filter(
      (i): i is string => typeof i === "string" && i.trim().length > 0,
    );
    const resumeSkills = (profile.resumeAnalysisResults?.skills ?? []).filter(
      (s): s is string => typeof s === "string" && s.trim().length > 0,
    );
    const academic = profile.academicLevel;

    const matchedInterests = profileInterests.filter((i) =>
      allInterests.some((opt) => opt.toLowerCase() === i.toLowerCase()),
    );
    const matchedSkills = resumeSkills.filter((s) =>
      allSkills.some((opt) => opt.toLowerCase() === s.toLowerCase()),
    );

    if (matchedInterests.length > 0 || matchedSkills.length > 0 || academic) {
      if (matchedInterests.length > 0 && selectedInterests.length === 0) {
        setSelectedInterests(matchedInterests.slice(0, MAX_PICK));
      }
      if (matchedSkills.length > 0 && selectedSkills.length === 0) {
        setSelectedSkills(matchedSkills.slice(0, MAX_PICK));
      }
      if (academic && ACADEMIC_LEVELS.some((l) => l.value === academic)) {
        setEducation(academic);
      }
      if (matchedInterests.length > 0 || matchedSkills.length > 0) {
        setUsedProfilePrefill(true);
      }
      prefillAppliedRef.current = true;
    }
    // Profile loaded but had nothing usable — still mark so we don't re-check.
    if (profile && skillsQ.isFetched && interestsQ.isFetched) {
      prefillAppliedRef.current = true;
    }
  }, [
    profile,
    skillsQ.data,
    skillsQ.isFetched,
    interestsQ.data,
    interestsQ.isFetched,
    allInterests,
    allSkills,
    selectedInterests.length,
    selectedSkills.length,
  ]);

  const filteredInterests = useMemo(() => {
    // Always include selected first, then all options
    const set = new Set<string>([...selectedInterests, ...allInterests]);
    return Array.from(set);
  }, [allInterests, selectedInterests]);

  const filteredSkills = useMemo(() => {
    const set = new Set<string>([...selectedSkills, ...allSkills]);
    return Array.from(set);
  }, [allSkills, selectedSkills]);

  const matchM = useMutation<MatchResponse, Error, void>({
    mutationFn: async () => {
      const educationLabel =
        ACADEMIC_LEVELS.find((l) => l.value === education)?.label ?? "Undergraduate";
      const body = {
        interests: selectedInterests,
        skills: selectedSkills,
        education: `${educationLabel} degree`,
        experience: "Entry level",
        workValues: [],
        timestamp: Date.now(),
      };
      return await apiRequest<MatchResponse>("POST", "/api/hybrid-career-match", body);
    },
  });

  const toggleInterest = (v: string) => {
    setSelectedInterests((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };
  const toggleSkill = (v: string) => {
    setSelectedSkills((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };

  const onMatch = () => {
    matchM.reset();
    matchM.mutate();
  };

  const onReset = () => {
    matchM.reset();
  };

  // Demo mode: as soon as the form is prefilled with profile data, fire the
  // match mutation automatically so the screen renders results without a
  // user tap. Required for the store-listing capture of this screen.
  const demoMatchFiredRef = useRef(false);
  useEffect(() => {
    if (!isDemoMode()) return;
    if (demoMatchFiredRef.current) return;
    if (!prefillAppliedRef.current) return;
    if (selectedInterests.length === 0 && selectedSkills.length === 0) return;
    demoMatchFiredRef.current = true;
    matchM.mutate();
  }, [matchM, selectedInterests.length, selectedSkills.length]);

  // Pull-to-refresh keeps the picker's options in sync with whatever the user
  // just did elsewhere (e.g. updated their resume or interests on the web).
  // We refetch the profile prefill plus the dynamic skill/interest catalogs,
  // the personalized career recs (which drive the "Matched to me" chip), and
  // the saved-items lookup (which drives the Saved badge); the match
  // mutation result is preserved so an in-progress comparison doesn't
  // disappear on a swipe.
  const refetchAll = useCallback(async () => {
    await Promise.all([
      profileQ.refetch(),
      skillsQ.refetch(),
      interestsQ.refetch(),
      careerRecsQ.refetch(),
      savedItemsQ.refetch(),
    ]);
  }, [profileQ, skillsQ, interestsQ, careerRecsQ, savedItemsQ]);

  // Silently re-pull the same set when the tab regains focus or the app
  // comes back from background, so saves/unsaves and profile edits made on
  // the web show up without requiring a manual pull. The helper also owns
  // the manual pull-to-refresh handler — it stamps the dedupe window after
  // the refetch resolves so a focus/app-active event right after a pull
  // can't trigger an extra silent refetch within the threshold.
  const { refresh: onRefresh, isRefreshing } = useRefreshSet(refetchAll);

  const results = matchM.data?.data?.careerOptions ?? [];
  const confidence = matchM.data?.data?.confidence;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <ScreenHeader
        title="Career Match"
        subtitle="Tell us what you love and what you're great at"
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
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
        {results.length > 0 ? (
          <ResultsView
            results={results}
            onReset={onReset}
            matchedOnly={matchedOnly}
            setMatchedOnly={setMatchedOnly}
            hasMatches={hasMatches}
            recommendedTitles={recommendedKeys.titles}
            recommendedOnetCodes={recommendedKeys.onetCodes}
            savedTitles={savedCareerKeys.titles}
            savedOnetCodes={savedCareerKeys.onetCodes}
            onOpen={(m, idx) => {
              router.push({
                pathname: "/career/[id]",
                params: {
                  id: m.career.onetCode || `match-${idx}`,
                  data: JSON.stringify(m),
                },
              });
            }}
          />
        ) : (
          <PickerView
            colors={colors}
            education={education}
            setEducation={setEducation}
            interests={filteredInterests}
            skills={filteredSkills}
            selectedInterests={selectedInterests}
            selectedSkills={selectedSkills}
            toggleInterest={toggleInterest}
            toggleSkill={toggleSkill}
            onMatch={onMatch}
            isLoading={matchM.isPending}
            error={matchM.error?.message ?? null}
            isError={matchM.isError}
            usedProfilePrefill={usedProfilePrefill}
            profileNeedsWork={profileNeedsWork}
            onGoToProfile={() => router.push("/(tabs)/profile")}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PickerView({
  colors,
  education,
  setEducation,
  interests,
  skills,
  selectedInterests,
  selectedSkills,
  toggleInterest,
  toggleSkill,
  onMatch,
  isLoading,
  error,
  isError,
  usedProfilePrefill,
  profileNeedsWork,
  onGoToProfile,
}: {
  colors: ReturnType<typeof useColors>;
  education: string;
  setEducation: (v: string) => void;
  interests: string[];
  skills: string[];
  selectedInterests: string[];
  selectedSkills: string[];
  toggleInterest: (v: string) => void;
  toggleSkill: (v: string) => void;
  onMatch: () => void;
  isLoading: boolean;
  error: string | null;
  isError: boolean;
  usedProfilePrefill: boolean;
  profileNeedsWork: boolean;
  onGoToProfile: () => void;
}) {
  const canMatch = selectedInterests.length > 0 && selectedSkills.length > 0;
  return (
    <View style={{ paddingHorizontal: 20, gap: 18 }}>
      {usedProfilePrefill ? (
        <Pressable
          onPress={onGoToProfile}
          style={({ pressed }) => [
            styles.prefillBanner,
            {
              backgroundColor: colors.accent,
              borderColor: colors.primary,
              borderRadius: colors.radius,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={[styles.prefillIcon, { backgroundColor: colors.primary }]}>
            <Feather name="user-check" size={16} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.foreground,
                fontFamily: SYSTEM_FONT, fontWeight: "600",
                fontSize: 13,
              }}
            >
              Using your profile
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT, fontWeight: "400",
                fontSize: 12,
                marginTop: 2,
              }}
            >
              Tweak picks below or update profile for better matches.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
      ) : profileNeedsWork ? (
        <Pressable
          onPress={onGoToProfile}
          style={({ pressed }) => [
            { borderRadius: colors.radius + 4, overflow: "hidden" },
            pressed ? { opacity: 0.92 } : null,
          ]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.prefillCta}
          >
            <View style={styles.prefillCtaIcon}>
              <Feather name="user-plus" size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefillCtaTitle}>
                Finish your profile to unlock matches
              </Text>
              <Text style={styles.prefillCtaSubtitle}>
                Add your interests and a resume to get personalized careers.
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      ) : null}

      <Card>
        <Text
          style={{
            color: colors.foreground,
            fontFamily: SYSTEM_FONT, fontWeight: "700",
            fontSize: 16,
          }}
        >
          What are you interested in?
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: SYSTEM_FONT, fontWeight: "400",
            fontSize: 13,
            marginTop: 4,
            marginBottom: 12,
          }}
        >
          Tap to pick a few interests (up to {MAX_PICK}).
        </Text>
        <MultiSelect
          options={interests}
          selected={selectedInterests}
          onChange={(next) => {
            // Reset to allow direct setter from modal
            const cur = new Set(selectedInterests);
            const nxt = new Set(next);
            // Toggle behaviour: pass the diff through toggleInterest to respect MAX_PICK
            cur.forEach((v) => {
              if (!nxt.has(v)) toggleInterest(v);
            });
            nxt.forEach((v) => {
              if (!cur.has(v)) toggleInterest(v);
            });
          }}
          placeholder="Choose interests"
          max={MAX_PICK}
        />
      </Card>

      <Card>
        <Text
          style={{
            color: colors.foreground,
            fontFamily: SYSTEM_FONT, fontWeight: "700",
            fontSize: 16,
          }}
        >
          What are you good at?
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: SYSTEM_FONT, fontWeight: "400",
            fontSize: 13,
            marginTop: 4,
            marginBottom: 12,
          }}
        >
          Tap to pick the skills you&apos;d like to use (up to {MAX_PICK}).
        </Text>
        <MultiSelect
          options={skills}
          selected={selectedSkills}
          onChange={(next) => {
            const cur = new Set(selectedSkills);
            const nxt = new Set(next);
            cur.forEach((v) => {
              if (!nxt.has(v)) toggleSkill(v);
            });
            nxt.forEach((v) => {
              if (!cur.has(v)) toggleSkill(v);
            });
          }}
          placeholder="Choose skills"
          max={MAX_PICK}
        />
      </Card>

      <Card>
        <Text
          style={{
            color: colors.foreground,
            fontFamily: SYSTEM_FONT, fontWeight: "700",
            fontSize: 16,
          }}
        >
          Education level
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: SYSTEM_FONT, fontWeight: "400",
            fontSize: 13,
            marginTop: 4,
            marginBottom: 12,
          }}
        >
          Helps tailor recommended pathways.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {ACADEMIC_LEVELS.map((l) => {
            const active = education === l.value;
            return (
              <Pressable
                key={l.value}
                onPress={() => setEducation(l.value)}
                style={({ pressed }) => [
                  styles.segment,
                  {
                    backgroundColor: active ? colors.primary : colors.muted,
                    borderColor: active ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? "#FFFFFF" : colors.foreground,
                    fontFamily: SYSTEM_FONT, fontWeight: active ? "600" : "500",
                    fontSize: 13,
                  }}
                >
                  {l.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {isError && error ? (
        <Card style={{ borderColor: colors.destructive, borderWidth: 1 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Feather name="alert-circle" size={18} color={colors.destructive} />
            <Text
              style={{
                color: colors.destructive,
                fontFamily: SYSTEM_FONT, fontWeight: "500",
                fontSize: 13,
                flex: 1,
              }}
            >
              {error}
            </Text>
          </View>
        </Card>
      ) : null}

      <PrimaryButton
        label={isLoading ? "Finding matches…" : "Match my careers"}
        onPress={onMatch}
        disabled={!canMatch || isLoading}
        loading={isLoading}
      />
    </View>
  );
}

function ResultsView({
  results,
  onReset,
  matchedOnly,
  setMatchedOnly,
  hasMatches,
  recommendedTitles,
  recommendedOnetCodes,
  savedTitles,
  savedOnetCodes,
  onOpen,
}: {
  results: CareerMatch[];
  onReset: () => void;
  matchedOnly: boolean;
  setMatchedOnly: (next: boolean | ((prev: boolean) => boolean)) => void;
  hasMatches: boolean;
  recommendedTitles: Set<string>;
  recommendedOnetCodes: Set<string>;
  savedTitles: Set<string>;
  savedOnetCodes: Set<string>;
  onOpen: (m: CareerMatch, idx: number) => void;
}) {
  const colors = useColors();

  // Filter on-demand match results down to those that also appear in the
  // user's saved profile-based career recommendations. We accept a hit on
  // either the normalized title or the onetCode to be resilient to small
  // formatting differences between the two pipelines.
  const filtered = useMemo(() => {
    if (!matchedOnly || !hasMatches) return results;
    return results.filter((m) => {
      const title = m.career.title?.trim().toLowerCase() ?? "";
      const code = m.career.onetCode?.trim() ?? "";
      return (
        (title.length > 0 && recommendedTitles.has(title)) ||
        (code.length > 0 && recommendedOnetCodes.has(code))
      );
    });
  }, [results, matchedOnly, hasMatches, recommendedTitles, recommendedOnetCodes]);

  const totalCount = results.length;
  const visibleCount = filtered.length;

  return (
    <View style={{ paddingHorizontal: 20, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <SectionHeader
            title={`${visibleCount} of ${totalCount} career matches`}
            subtitle="Ranked by your interests, skills & market signals"
          />
        </View>
        <Pressable
          onPress={onReset}
          style={({ pressed }) => [
            styles.resetBtn,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="refresh-cw" size={14} color={colors.primary} />
          <Text
            style={{
              color: colors.primary,
              fontFamily: SYSTEM_FONT, fontWeight: "600",
              fontSize: 12,
            }}
          >
            Redo
          </Text>
        </Pressable>
      </View>

      {hasMatches ? (
        <View style={{ flexDirection: "row" }}>
          <Pressable
            onPress={() => setMatchedOnly((v) => !v)}
            style={({ pressed }) => [
              styles.matchedChip,
              {
                backgroundColor: matchedOnly ? colors.primary : colors.muted,
                borderColor: matchedOnly ? colors.primary : colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: matchedOnly }}
            accessibilityLabel="Filter to careers matched to me"
          >
            <Feather
              name="star"
              size={12}
              color={matchedOnly ? "#FFFFFF" : colors.primary}
            />
            <Text
              style={{
                color: matchedOnly ? "#FFFFFF" : colors.foreground,
                fontFamily: SYSTEM_FONT,
                fontWeight: matchedOnly ? "600" : "500",
                fontSize: 13,
              }}
            >
              Matched to me
            </Text>
          </Pressable>
        </View>
      ) : null}

      {matchedOnly && hasMatches && filtered.length === 0 ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name="info" size={18} color={colors.mutedForeground} />
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT,
                fontWeight: "500",
                fontSize: 13,
                flex: 1,
              }}
            >
              None of these matches overlap with your saved profile picks.
              Turn off the filter to see them all.
            </Text>
          </View>
        </Card>
      ) : null}

      {filtered.map((m, idx) => {
        const c = m.career;
        const md = m.marketData ?? null;
        const fit =
          typeof c.topKConfidence === "number" ? fitLabel(c.topKConfidence) : null;
        const salary =
          typeof c.averageSalary === "number" && c.averageSalary > 0
            ? `$${Math.round(c.averageSalary / 1000)}k`
            : null;
        const keySkills = (c.requiredSkills ?? []).slice(0, 3);
        const matchReasons = pickMatchReasons(m.matchDetails?.matchReasons);
        const titleKey = c.title?.trim().toLowerCase() ?? "";
        const codeKey = c.onetCode?.trim() ?? "";
        const isSaved =
          (titleKey.length > 0 && savedTitles.has(titleKey)) ||
          (codeKey.length > 0 && savedOnetCodes.has(codeKey));
        return (
          <Card key={`${c.title}-${idx}`} onPress={() => onOpen(m, idx)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: colors.accent },
                ]}
              >
                <Feather name="briefcase" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={2}
                  style={{
                    color: colors.foreground,
                    fontFamily: SYSTEM_FONT, fontWeight: "700",
                    fontSize: 16,
                  }}
                >
                  {c.title}
                </Text>
                <MatchReasonChips reasons={matchReasons} />
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                {fit ? (
                  <View
                    style={[
                      styles.matchBadge,
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
                      {fit}
                    </Text>
                  </View>
                ) : null}
                {isSaved ? <SavedBadge /> : null}
              </View>
            </View>

            {c.description ? (
              <Text
                numberOfLines={3}
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT, fontWeight: "400",
                  fontSize: 13,
                  marginTop: 10,
                  lineHeight: 19,
                }}
              >
                {c.description}
              </Text>
            ) : null}

            <View style={styles.metaRow}>
              {salary ? <Pill icon="dollar-sign" text={`${salary} median`} /> : null}
              {c.growthOutlook ? <Pill icon="trending-up" text={c.growthOutlook} /> : null}
              {md?.demandLevel ? <Pill icon="activity" text={`${md.demandLevel} demand`} /> : null}
              {md?.remoteFriendly ? <Pill icon="wifi" text="Remote-friendly" /> : null}
            </View>

            {keySkills.length > 0 ? (
              <View style={styles.metaRow}>
                {keySkills.map((s) => (
                  <Pill key={s} icon="check" text={s} />
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
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

function Pill({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  text: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: colors.muted, borderColor: colors.border },
      ]}
    >
      <Feather name={icon} size={11} color={colors.mutedForeground} />
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: SYSTEM_FONT, fontWeight: "500",
          fontSize: 11,
        }}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 42,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 8,
  },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  matchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 200,
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
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 12,
    marginLeft: 12,
  },
  matchedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  prefillBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
  prefillIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  prefillCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  prefillCtaIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  prefillCtaTitle: {
    color: "#FFFFFF",
    fontFamily: SYSTEM_FONT, fontWeight: "700",
    fontSize: 14,
  },
  prefillCtaSubtitle: {
    color: "rgba(255,255,255,0.92)",
    fontFamily: SYSTEM_FONT, fontWeight: "400",
    fontSize: 12,
    marginTop: 2,
  },
});
