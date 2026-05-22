import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { MultiSelect } from "@/components/MultiSelect";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionHeader } from "@/components/SectionHeader";
import {
  ACADEMIC_LEVELS,
  DEMOGRAPHICS,
  FALLBACK_INTERESTS,
  FINANCIAL_NEED,
  US_STATES,
} from "@/constants/profile-options";
import { useAutoRefreshOnFocus } from "@/hooks/useAutoRefreshOnFocus";
import { useColors } from "@/hooks/useColors";
import { apiGet, apiRequest, getApiBase, getSessionCookie } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { fitLabel, isScholarshipOpen } from "@/lib/utils";
import { SYSTEM_FONT } from "@/lib/typography";

type ResumeInfo = {
  hasResume?: boolean;
  fileName?: string | null;
  uploadDate?: string | null;
  fileType?: string | null;
  hasAnalysis?: boolean;
};

type ResumeUploadResult = {
  success?: boolean;
  analysis?: {
    skills?: string[];
    interests?: string[];
    education?: Array<{ degree?: string; institution?: string }>;
    educationLevel?: string;
    keywords?: string[];
    atsScore?: number;
  };
  message?: string;
};

type ProfileData = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  bio?: string | null;
  state?: string | null;
  gpa?: number | string | null;
  major?: string | null;
  academicLevel?: string | null;
  graduationYear?: number | string | null;
  financialNeed?: string | null;
  interests?: string[] | null;
  demographics?: string[] | null;
  profilePicture?: string | null;
  profileCompleteness?: number;
  insights?: string[];
  resumeFileName?: string | null;
  resumeAnalysisResults?: {
    skills?: string[];
    interests?: string[];
    keywords?: string[];
  } | null;
};

type ForYouCareerEntry = {
  career?: {
    title?: string;
    description?: string;
    averageSalary?: number;
    onetCode?: string;
  };
  matchScore?: number;
};

type ForYouScholarshipEntry = {
  scholarship?: {
    name?: string;
    amount?: number;
    provider?: string;
    deadline?: string | null;
    deadlineAt?: string | null;
    isActive?: boolean | null;
    website?: string | null;
    description?: string | null;
    type?: string | null;
  };
  matchScore?: number;
  deadlineAt?: string | null;
  deadline?: string | null;
  isActive?: boolean | null;
};

type ForYouRecommendation = {
  // /api/profile/for-you returns NESTED entries: { career: {...} } / { scholarship: {...} }
  careers?: ForYouCareerEntry[];
  scholarships?: ForYouScholarshipEntry[];
  recommendations?: {
    careerCount?: number;
    scholarshipCount?: number;
  };
  freshlyGenerated?: boolean;
};

type Tab = "for-you" | "profile" | "resume";

export default function ProfileTab() {
  const colors = useColors();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("profile");

  const profileQ = useQuery<ProfileData | null>({
    queryKey: ["/api/profile"],
    queryFn: async () => apiGet<ProfileData | null>("/api/profile", { allowUnauthorized: true }),
  });

  const profile = profileQ.data ?? null;

  // Silently refetch the profile when the tab regains focus or the app
  // returns from background, so changes made on the web (major, state,
  // interests, resume upload, etc.) show up without a pull-to-refresh.
  const refetchProfile = useCallback(() => profileQ.refetch(), [profileQ]);
  useAutoRefreshOnFocus(refetchProfile);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "Your account";

  const handleSignOut = () => {
    if (Platform.OS === "web") {
      void signOut();
      return;
    }
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => void signOut(),
      },
    ]);
  };

  const pictureM = useMutation({
    mutationFn: async () => {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          throw new Error("We need photo library permission to upload a picture.");
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return null;
      const asset = result.assets[0];
      const form = new FormData();
      const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
      const type = asset.mimeType ?? "image/jpeg";
      if (Platform.OS === "web") {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        form.append("profilePicture", blob, name);
      } else {
        form.append("profilePicture", {
          uri: asset.uri,
          name,
          type,
        } as unknown as Blob);
      }
      const cookie = await getSessionCookie();
      const headers: Record<string, string> = { Accept: "application/json" };
      if (cookie) headers.Cookie = cookie;
      const upload = await fetch(`${getApiBase()}/api/upload-profile-picture`, {
        method: "POST",
        body: form,
        headers,
        credentials: "include",
      });
      if (!upload.ok) {
        const text = await upload.text().catch(() => "");
        throw new Error(text || `Upload failed (${upload.status})`);
      }
      return true;
    },
    onSuccess: (changed) => {
      if (!changed) return;
      Alert.alert("Profile picture updated");
      void qc.invalidateQueries({ queryKey: ["/api/profile"] });
      void qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (e) => {
      Alert.alert(
        "Couldn't update picture",
        e instanceof Error ? e.message : "Please try again.",
      );
    },
  });

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Profile" subtitle="Your account, plan & matches" />

        <View style={{ paddingHorizontal: 20 }}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Pressable
                onPress={() => pictureM.mutate()}
                disabled={pictureM.isPending}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                {profile?.profilePicture ? (
                  <View style={[styles.avatar, { overflow: "hidden", backgroundColor: colors.muted }]}>
                    <Image
                      source={{ uri: profile.profilePicture }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  </View>
                ) : (
                  <LinearGradient
                    colors={[colors.primary, colors.primaryEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatar}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontFamily: SYSTEM_FONT, fontWeight: "700",
                        fontSize: 22,
                      }}
                    >
                      {(displayName.trim()[0] || "U").toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
                <View
                  style={{
                    position: "absolute",
                    right: -2,
                    bottom: -2,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: colors.card,
                  }}
                >
                  {pictureM.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="camera" size={11} color="#FFFFFF" />
                  )}
                </View>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: SYSTEM_FONT, fontWeight: "700",
                    fontSize: 17,
                  }}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: SYSTEM_FONT, fontWeight: "400",
                    fontSize: 13,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {user?.username ? `@${user.username}` : "Your account"}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={{ height: 18 }} />

        <View style={{ paddingHorizontal: 20 }}>
          <View
            style={[
              styles.tabBar,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            {(
              [
                { key: "for-you" as Tab, label: "For You", icon: "star" as const },
                { key: "profile" as Tab, label: "Profile", icon: "user" as const },
                { key: "resume" as Tab, label: "Resume", icon: "file-text" as const },
              ]
            ).map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={({ pressed }) => [
                    styles.tabBtn,
                    active
                      ? { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }
                      : null,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Feather
                    name={t.icon}
                    size={14}
                    color={active ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={{
                      color: active ? colors.primary : colors.mutedForeground,
                      fontFamily: SYSTEM_FONT, fontWeight: active ? "700" : "500",
                      fontSize: 13,
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ height: 18 }} />

        {tab === "for-you" ? (
          <ForYouView onGoToProfile={() => setTab("profile")} />
        ) : tab === "profile" ? (
          <ProfileEditor
            profile={profile}
            isLoading={profileQ.isLoading}
            onSaved={() => {
              void qc.invalidateQueries({ queryKey: ["/api/profile"] });
              void qc.invalidateQueries({ queryKey: ["/api/profile/for-you"] });
              // Home tab pulls from these dedicated endpoints — keep them in sync.
              void qc.invalidateQueries({ queryKey: ["/api/profile/career-recommendations"] });
              void qc.invalidateQueries({ queryKey: ["/api/profile/scholarship-recommendations"] });
              setTab("for-you");
            }}
          />
        ) : (
          <ResumeView
            profile={profile}
            onUploaded={() => {
              void qc.invalidateQueries({ queryKey: ["/api/profile"] });
              void qc.invalidateQueries({ queryKey: ["/api/resume/info"] });
              void qc.invalidateQueries({ queryKey: ["/api/profile/for-you"] });
              // Home tab pulls from these dedicated endpoints — keep them in sync.
              void qc.invalidateQueries({ queryKey: ["/api/profile/career-recommendations"] });
              void qc.invalidateQueries({ queryKey: ["/api/profile/scholarship-recommendations"] });
              setTab("for-you");
            }}
          />
        )}

        <View style={{ height: 24 }} />

        <View style={{ paddingHorizontal: 20 }}>
          <SectionHeader title="My Plan" />
          <Card onPress={() => router.push("/saved")}>
            <View style={styles.actionRow}>
              <View style={[styles.fileIcon, { backgroundColor: colors.accent }]}>
                <Feather name="bookmark" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: SYSTEM_FONT, fontWeight: "600", fontSize: 15 }}>
                  View saved items
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: SYSTEM_FONT, fontWeight: "400",
                    fontSize: 13,
                    marginTop: 2,
                  }}
                >
                  Careers, colleges & scholarships you've saved
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </View>
          </Card>
        </View>

        <View style={{ height: 18 }} />

        <View style={{ paddingHorizontal: 20 }}>
          <SectionHeader title="Help & Legal" />
          <Card>
            <HelpLinkRow
              icon="shield"
              label="Privacy Policy"
              path="/privacy"
              isFirst
            />
            <HelpLinkRow
              icon="help-circle"
              label="Support"
              path="/support"
            />
            <HelpLinkRow
              icon="file-text"
              label="Terms of Service"
              path="/terms"
            />
          </Card>
        </View>

        <View style={{ height: 18 }} />

        <View style={{ paddingHorizontal: 20 }}>
          <SectionHeader title="Account" />
          <Card>
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [
                styles.actionRow,
                pressed ? { opacity: 0.7 } : null,
              ]}
            >
              <Feather name="log-out" size={18} color={colors.destructive} />
              <Text
                style={{
                  color: colors.destructive,
                  fontFamily: SYSTEM_FONT, fontWeight: "600",
                  fontSize: 14,
                }}
              >
                Sign out
              </Text>
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- For You tab -------------------- */

function ForYouView({ onGoToProfile }: { onGoToProfile: () => void }) {
  const colors = useColors();
  const router = useRouter();

  const q = useQuery<ForYouRecommendation | null>({
    queryKey: ["/api/profile/for-you"],
    queryFn: async () => apiGet<ForYouRecommendation | null>("/api/profile/for-you", {
      allowUnauthorized: true,
    }),
  });

  // Silently refetch when the parent Profile tab regains focus or the
  // app returns from background, so newly-run matches on the web show
  // up without a pull-to-refresh.
  //
  // Sub-tabs unmount/remount when the user switches between Profile, For
  // You and Resume, so we hand the hook React Query's `isFetching` /
  // `dataUpdatedAt` (which live on the QueryClient and survive remounts)
  // as the dedupe source instead of letting it fall back to local refs.
  useAutoRefreshOnFocus(() => q.refetch(), {
    isFetching: q.isFetching,
    dataUpdatedAt: q.dataUpdatedAt,
  });

  if (q.isLoading) {
    return (
      <View style={[styles.center, { paddingVertical: 60 }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // /api/profile/for-you returns NESTED entries — normalize to flat shape for rendering.
  const allCareers = (q.data?.careers ?? [])
    .map((entry) => ({
      title: entry.career?.title ?? "",
      description: entry.career?.description ?? "",
      averageSalary: entry.career?.averageSalary,
      onetCode: entry.career?.onetCode,
      matchScore: entry.matchScore,
    }))
    .filter((c) => c.title.length > 0);

  const allScholarships = (q.data?.scholarships ?? [])
    .map((entry) => ({
      name: entry.scholarship?.name ?? "",
      provider: entry.scholarship?.provider,
      amount: entry.scholarship?.amount,
      website: entry.scholarship?.website,
      deadline: entry.scholarship?.deadline ?? entry.deadline ?? null,
      deadlineAt: entry.scholarship?.deadlineAt ?? entry.deadlineAt ?? null,
      isActive: entry.scholarship?.isActive ?? entry.isActive ?? null,
      description: entry.scholarship?.description ?? null,
      type: entry.scholarship?.type ?? null,
      matchScore: entry.matchScore,
    }))
    .filter((s) => s.name.length > 0)
    .filter(isScholarshipOpen);
  const careers = allCareers.slice(0, 2);
  const scholarships = allScholarships.slice(0, 2);
  const empty = careers.length === 0 && scholarships.length === 0;

  if (empty) {
    return (
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <Card>
          <EmptyState
            icon="star"
            title="Personalize to see matches"
            message="Add your interests, demographics, and resume so we can recommend careers and scholarships made for you."
          />
          <View style={{ marginTop: 14 }}>
            <PrimaryButton label="Complete your profile" onPress={onGoToProfile} />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 20, gap: 18 }}>
      {careers.length > 0 ? (
        <View>
          <SectionHeader
            title="Careers For You"
            subtitle="Personalized from your interests, skills & resume"
          />
          <View style={{ gap: 10 }}>
            {careers.map((c, idx) => (
              <Card
                key={`${c.title}-${idx}`}
                onPress={() =>
                  router.push({
                    pathname: "/career/[id]",
                    params: {
                      id: c.onetCode || `for-you-${idx}`,
                      data: JSON.stringify({
                        career: {
                          title: c.title,
                          description: c.description,
                          averageSalary: c.averageSalary,
                          topKConfidence: c.matchScore,
                          onetCode: c.onetCode,
                        },
                      }),
                    },
                  })
                }
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
                    <Feather name="briefcase" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={2}
                      style={{
                        color: colors.foreground,
                        fontFamily: SYSTEM_FONT, fontWeight: "700",
                        fontSize: 15,
                      }}
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
                  </View>
                  {typeof c.matchScore === "number" ? (
                    <FitPill label={fitLabel(c.matchScore)} />
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        </View>
      ) : null}

      {scholarships.length > 0 ? (
        <View>
          <SectionHeader
            title="Scholarships For You"
            subtitle="Targeted to your demographics & financial need"
          />
          <View style={{ gap: 10 }}>
            {scholarships.map((s, idx) => (
              <Card
                key={`${s.name}-${idx}`}
                onPress={() =>
                  router.push({
                    pathname: "/scholarship/[id]",
                    params: {
                      id: s.name,
                      // Pass the full recommendation payload so the detail
                      // screen can render even when the matcher's
                      // hardcoded scholarship isn't in the DB (e.g. UNCF
                      // General Scholarship). The reader JSON.parses this
                      // directly — Expo Router URL-encodes route params
                      // automatically, so do NOT call encodeURIComponent.
                      data: JSON.stringify(s),
                    },
                  } as any)
                }
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
                    <Feather name="award" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={2}
                      style={{ color: colors.foreground, fontFamily: SYSTEM_FONT, fontWeight: "700", fontSize: 15 }}
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
                      {s.provider || "Verified provider"}
                      {typeof s.amount === "number" && s.amount > 0
                        ? `  ·  $${s.amount.toLocaleString()}`
                        : ""}
                    </Text>
                  </View>
                  {typeof s.matchScore === "number" ? (
                    <FitPill label={fitLabel(s.matchScore)} />
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        </View>
      ) : null}

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
            <Feather name="target" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.foreground,
                fontFamily: SYSTEM_FONT,
                fontWeight: "700",
                fontSize: 15,
              }}
            >
              Want a deeper career match?
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT,
                fontWeight: "400",
                fontSize: 12,
                marginTop: 2,
              }}
            >
              Pick exact interests &amp; skills to fine-tune your top careers.
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <PrimaryButton
            label="Open Career Match"
            onPress={() => router.push("/(tabs)/careers")}
          />
        </View>
      </Card>
    </View>
  );
}

function MatchPill({ value }: { value: number }) {
  const colors = useColors();
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: colors.accent,
      }}
    >
      <Feather name="target" size={11} color={colors.primary} />
      <Text style={{ color: colors.primary, fontFamily: SYSTEM_FONT, fontWeight: "700", fontSize: 11 }}>
        {v}%
      </Text>
    </View>
  );
}

function FitPill({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: colors.accent,
      }}
    >
      <Text style={{ color: colors.primary, fontFamily: SYSTEM_FONT, fontWeight: "700", fontSize: 11 }}>
        {label}
      </Text>
    </View>
  );
}

/* -------------------- Profile editor tab -------------------- */

function ProfileEditor({
  profile,
  isLoading,
  onSaved,
}: {
  profile: ProfileData | null;
  isLoading: boolean;
  onSaved: () => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gpa, setGpa] = useState("");
  const [major, setMajor] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [academicLevel, setAcademicLevel] = useState<string>("undergraduate");
  const [financialNeed, setFinancialNeed] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [demographics, setDemographics] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [statePickerOpen, setStatePickerOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName ?? "");
    setLastName(profile.lastName ?? "");
    setGpa(profile.gpa ? String(profile.gpa) : "");
    setMajor(profile.major ?? "");
    setGraduationYear(profile.graduationYear ? String(profile.graduationYear) : "");
    setAcademicLevel(profile.academicLevel ?? "undergraduate");
    setFinancialNeed(profile.financialNeed ?? "");
    setState(profile.state ?? "");
    setDemographics(profile.demographics ?? []);
    setInterests(profile.interests ?? []);
  }, [profile]);

  const saveM = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        major: major.trim() || null,
        academicLevel,
        graduationYear: graduationYear ? Number(graduationYear) : null,
        financialNeed: financialNeed || null,
        state: state || null,
        demographics,
        interests,
      };
      const gpaNum = gpa ? Number(gpa) : NaN;
      if (Number.isFinite(gpaNum)) body.gpa = gpaNum;
      return await apiRequest("PUT", "/api/profile", body);
    },
    onSuccess: () => {
      onSaved();
      Alert.alert(
        "Profile saved",
        "Here are your latest matches based on your profile and resume.",
      );
    },
    onError: (e) => {
      Alert.alert(
        "Couldn't save profile",
        e instanceof Error ? e.message : "Please try again.",
      );
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingVertical: 60 }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 20, gap: 18 }}>
      <Card>
        <SectionHeader title="About you" />
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Jane"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Doe"
              />
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeader title="Academics" />
        <View style={{ gap: 12 }}>
          <Input
            label="Major / area of study"
            value={major}
            onChangeText={setMajor}
            placeholder="e.g. Computer Science"
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="GPA"
                value={gpa}
                onChangeText={setGpa}
                placeholder="3.7"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Grad year"
                value={graduationYear}
                onChangeText={setGraduationYear}
                placeholder="2027"
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View>
            <Label>Academic level</Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ACADEMIC_LEVELS.map((l) => {
                const active = academicLevel === l.value;
                return (
                  <Pressable
                    key={l.value}
                    onPress={() => setAcademicLevel(l.value)}
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
          </View>

          <View>
            <Label>State</Label>
            <Pressable
              onPress={() => setStatePickerOpen(true)}
              style={({ pressed }) => [
                styles.selectBtn,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: state ? colors.foreground : colors.mutedForeground,
                  fontFamily: SYSTEM_FONT, fontWeight: state ? "500" : "400",
                  fontSize: 14,
                  flex: 1,
                }}
              >
                {state || "Select your state"}
              </Text>
              <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeader
          title="Demographics"
          subtitle="Used for targeted scholarships — never shared with schools"
        />
        <MultiSelect
          label="Select all that apply"
          options={DEMOGRAPHICS}
          selected={demographics}
          onChange={setDemographics}
          placeholder="Choose demographics"
          searchable={false}
        />
      </Card>

      <Card>
        <SectionHeader
          title="Career interests"
          subtitle="Drives your career and college recommendations"
        />
        <MultiSelect
          label="Pick your top interests"
          options={FALLBACK_INTERESTS}
          selected={interests}
          onChange={setInterests}
          placeholder="Choose career interests"
        />
      </Card>

      <Card>
        <SectionHeader title="Financial need" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {FINANCIAL_NEED.map((f) => {
            const active = financialNeed === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFinancialNeed(active ? "" : f.value)}
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
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <PrimaryButton
        label="Save profile"
        onPress={() => saveM.mutate()}
        loading={saveM.isPending}
      />

      <Modal
        visible={statePickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setStatePickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: SYSTEM_FONT, fontWeight: "700",
                  fontSize: 17,
                }}
              >
                Choose your state
              </Text>
              <Pressable onPress={() => setStatePickerOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {US_STATES.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => {
                    setState(s);
                    setStatePickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.stateRow,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: pressed ? colors.muted : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: SYSTEM_FONT, fontWeight: state === s ? "700" : "500",
                      fontSize: 15,
                    }}
                  >
                    {s}
                  </Text>
                  {state === s ? (
                    <Feather name="check" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text
      style={{
        color: colors.foreground,
        fontFamily: SYSTEM_FONT, fontWeight: "600",
        fontSize: 13,
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

function HelpLinkRow({
  icon,
  label,
  path,
  isFirst,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  path: string;
  isFirst?: boolean;
}) {
  const colors = useColors();
  const handlePress = async () => {
    try {
      const url = `${getApiBase()}${path}`;
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert("Couldn't open link", "Please try again.");
    }
  };
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          borderTopWidth: isFirst ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.accent, width: 36, height: 36, borderRadius: 10 }]}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <Text
        style={{
          flex: 1,
          color: colors.foreground,
          fontFamily: SYSTEM_FONT,
          fontWeight: "600",
          fontSize: 14,
        }}
      >
        {label}
      </Text>
      <Feather name="external-link" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

/* -------------------- Resume tab -------------------- */

function ResumeView({
  profile,
  onUploaded,
}: {
  profile: ProfileData | null;
  onUploaded: () => void;
}) {
  const colors = useColors();
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState<ResumeUploadResult["analysis"] | null>(null);

  const resumeQ = useQuery<ResumeInfo | null>({
    queryKey: ["/api/resume/info"],
    queryFn: async () => apiGet<ResumeInfo | null>("/api/resume/info", { allowUnauthorized: true }),
  });

  // Silently refetch when the parent Profile tab regains focus or the
  // app returns from background, so a resume uploaded on the web shows
  // up without a pull-to-refresh.
  //
  // Sub-tabs unmount/remount when the user switches between Profile, For
  // You and Resume, so we hand the hook React Query's `isFetching` /
  // `dataUpdatedAt` (which live on the QueryClient and survive remounts)
  // as the dedupe source instead of letting it fall back to local refs.
  useAutoRefreshOnFocus(() => resumeQ.refetch(), {
    isFetching: resumeQ.isFetching,
    dataUpdatedAt: resumeQ.dataUpdatedAt,
  });

  const resume = resumeQ.data ?? null;
  const savedAnalysis = profile?.resumeAnalysisResults ?? null;

  const handleUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];

      setUploading(true);
      const form = new FormData();
      // @ts-expect-error - RN FormData accepts {uri, name, type}
      form.append("resume", {
        uri: asset.uri,
        name: asset.name ?? "resume.pdf",
        type: asset.mimeType ?? "application/pdf",
      });

      const cookie = await getSessionCookie();
      const headers: Record<string, string> = {};
      if (cookie) headers["Cookie"] = cookie;

      const response = await fetch(`${getApiBase()}/api/upload-resume`, {
        method: "POST",
        body: form,
        headers,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`);
      }
      const result = (await response.json().catch(() => null)) as ResumeUploadResult | null;
      if (result?.analysis) setAnalysis(result.analysis);
      Alert.alert("Resume uploaded", "We extracted your skills to power matches.");
      onUploaded();
    } catch (e) {
      Alert.alert(
        "Upload failed",
        e instanceof Error ? e.message : "Could not upload your resume.",
      );
    } finally {
      setUploading(false);
    }
  };

  const skills = analysis?.skills ?? savedAnalysis?.skills ?? [];
  const interests = analysis?.interests ?? savedAnalysis?.interests ?? [];
  const keywords = analysis?.keywords ?? savedAnalysis?.keywords ?? [];

  return (
    <View style={{ paddingHorizontal: 20, gap: 18 }}>
      <Card>
        <SectionHeader
          title="Your resume"
          subtitle="Powers personalized career & scholarship matches"
        />
        {resumeQ.isLoading ? (
          <View style={{ paddingVertical: 12, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : resume?.fileName ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[styles.fileIcon, { backgroundColor: colors.accent }]}>
                <Feather name="file-text" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: SYSTEM_FONT, fontWeight: "600",
                    fontSize: 14,
                  }}
                  numberOfLines={1}
                >
                  {resume.fileName}
                </Text>
                {resume.uploadDate ? (
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: SYSTEM_FONT, fontWeight: "400",
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    Uploaded{" "}
                    {new Date(resume.uploadDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                ) : null}
              </View>
            </View>
            <PrimaryButton
              label="Replace resume"
              variant="secondary"
              onPress={handleUpload}
              loading={uploading}
            />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT, fontWeight: "400",
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              Upload a PDF or DOCX. We'll extract your skills, interests, and
              education to match careers and scholarships made for you.
            </Text>
            <PrimaryButton
              label="Choose file"
              onPress={handleUpload}
              loading={uploading}
            />
          </View>
        )}
      </Card>

      {(skills.length > 0 || interests.length > 0 || keywords.length > 0) ? (
        <Card>
          <SectionHeader
            title="What we extracted"
            subtitle="Used to refine your For You recommendations"
          />
          {skills.length > 0 ? (
            <ExtractedRow label="Skills" items={skills} />
          ) : null}
          {interests.length > 0 ? (
            <ExtractedRow label="Interests" items={interests} />
          ) : null}
          {keywords.length > 0 ? (
            <ExtractedRow label="Keywords" items={keywords.slice(0, 16)} />
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}

function ExtractedRow({ label, items }: { label: string; items: string[] }) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          color: colors.foreground,
          fontFamily: SYSTEM_FONT, fontWeight: "700",
          fontSize: 13,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {items.map((s) => (
          <View
            key={s}
            style={{
              backgroundColor: colors.accent,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontFamily: SYSTEM_FONT, fontWeight: "500",
                fontSize: 12,
              }}
            >
              {s}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  tabBar: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 999,
  },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "80%",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  center: { alignItems: "center", justifyContent: "center" },
});
