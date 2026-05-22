import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { apiRequest } from "@/lib/api";
import { SYSTEM_FONT } from "@/lib/typography";

const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
];

interface JobMarketData {
  career: string;
  seriesId: string;
  medianAnnualWage: number;
  hourlyWage: number;
  trend: "rising" | "declining" | "stable";
  trendPercentage: number;
  year: string;
  period: string;
}

interface StateJobData {
  state: string;
  seriesId: string;
  medianAnnualWage: number;
  year: string;
  employment: number | null;
}

interface SupportedCareer {
  title: string;
  key: string;
  seriesId: string;
}

interface SeriesPoint {
  value: string | number;
  year: string;
  period: string;
}

type Tab = "careers" | "states" | "series";

const CACHE_KEY = "job-market-cache";

export default function JobMarketScreen() {
  const colors = useColors();
  const [tab, setTab] = useState<Tab>("careers");
  const [selectedCareer, setSelectedCareer] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("CA");
  const [seriesIdInput, setSeriesIdInput] = useState("");
  const [careerPickerOpen, setCareerPickerOpen] = useState(false);
  const [statePickerOpen, setStatePickerOpen] = useState(false);

  const careersQ = useQuery<SupportedCareer[]>({
    queryKey: ["/api/job-market/careers"],
    queryFn: async () =>
      (await apiRequest<SupportedCareer[]>("GET", "/api/job-market/careers")) ?? [],
    staleTime: 60 * 60 * 1000,
  });

  const jobDataQ = useQuery<JobMarketData | null>({
    queryKey: ["/api/job-market/career", selectedCareer],
    queryFn: async () =>
      apiRequest<JobMarketData>(
        "GET",
        `/api/job-market/career/${encodeURIComponent(selectedCareer)}`,
      ),
    enabled: !!selectedCareer,
    staleTime: 15 * 60 * 1000,
  });

  const stateDataQ = useQuery<StateJobData | null>({
    queryKey: ["/api/job-market/state", selectedState, "career", selectedCareer],
    queryFn: async () =>
      apiRequest<StateJobData>(
        "GET",
        `/api/job-market/state/${selectedState}/career/${encodeURIComponent(
          selectedCareer,
        )}`,
      ),
    enabled: !!selectedCareer && !!selectedState && tab === "states",
    staleTime: 15 * 60 * 1000,
  });

  const seriesQ = useQuery<{ data: SeriesPoint[] } | null>({
    queryKey: ["/api/job-market/series", seriesIdInput],
    queryFn: async () =>
      apiRequest<{ data: SeriesPoint[] }>(
        "GET",
        `/api/job-market/series/${seriesIdInput}`,
      ),
    enabled: tab === "series" && seriesIdInput.length > 10,
    staleTime: 15 * 60 * 1000,
  });

  // Cache last loaded data per career
  useEffect(() => {
    if (!jobDataQ.data || !selectedCareer) return;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        const cache = raw ? JSON.parse(raw) : {};
        cache[selectedCareer] = { data: jobDataQ.data, timestamp: Date.now() };
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch {
        // ignore
      }
    })();
  }, [jobDataQ.data, selectedCareer]);

  const careers = careersQ.data ?? [];
  const selectedCareerLabel =
    careers.find((c) => c.key === selectedCareer)?.title ?? "Select a career";
  const selectedStateLabel =
    US_STATES.find((s) => s.code === selectedState)?.name ?? selectedState;

  const trendColor = (t?: string) => {
    if (t === "rising") return "#16A34A";
    if (t === "declining") return "#DC2626";
    return colors.mutedForeground;
  };
  const trendIcon = (t?: string): React.ComponentProps<typeof Feather>["name"] => {
    if (t === "rising") return "trending-up";
    if (t === "declining") return "trending-down";
    return "minus";
  };
  const trendBadge = (t?: string) => {
    if (t === "rising") return "Growing market";
    if (t === "declining") return "Declining market";
    return "Stable market";
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScreenHeader
        showBack
        title="Job Market Intelligence"
        subtitle="Real-time wage data and employment trends from the Bureau of Labor Statistics"
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >

        {/* Tab bar */}
        <View
          style={[
            styles.tabBar,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
        >
          {(
            [
              { key: "careers" as Tab, label: "Careers" },
              { key: "states" as Tab, label: "States" },
              { key: "series" as Tab, label: "BLS Series" },
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
                    ? {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        borderWidth: 1,
                      }
                    : null,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
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

        {/* Career picker (used by careers + states tabs) */}
        {tab !== "series" ? (
          <Pressable
            onPress={() => setCareerPickerOpen(true)}
            style={({ pressed }) => [
              styles.selectField,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                borderRadius: colors.radius,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text
              style={{
                color: selectedCareer ? colors.foreground : colors.mutedForeground,
                fontFamily: SYSTEM_FONT, fontWeight: "500",
                fontSize: 14,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {selectedCareer ? selectedCareerLabel : "Select a career to view data"}
            </Text>
            <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}

        {/* State picker (states tab) */}
        {tab === "states" ? (
          <Pressable
            onPress={() => setStatePickerOpen(true)}
            style={({ pressed }) => [
              styles.selectField,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                borderRadius: colors.radius,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Feather name="map-pin" size={16} color={colors.primary} />
            <Text
              style={{
                color: colors.foreground,
                fontFamily: SYSTEM_FONT, fontWeight: "500",
                fontSize: 14,
                flex: 1,
                marginLeft: 8,
              }}
              numberOfLines={1}
            >
              {selectedStateLabel}
            </Text>
            <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}

        {/* Loading careers list */}
        {careersQ.isLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <ActivityIndicator color={colors.primary} />
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT, fontWeight: "400",
                fontSize: 13,
                marginTop: 8,
              }}
            >
              Loading job market data…
            </Text>
          </View>
        ) : null}

        {/* CAREERS TAB */}
        {tab === "careers" && selectedCareer ? (
          jobDataQ.isLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <ActivityIndicator color={colors.primary} />
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT, fontWeight: "400",
                  fontSize: 13,
                  marginTop: 8,
                }}
              >
                Loading wage data…
              </Text>
            </View>
          ) : jobDataQ.isError || !jobDataQ.data ? (
            <Card>
              <Text
                style={{
                  color: "#DC2626",
                  fontFamily: SYSTEM_FONT, fontWeight: "500",
                  fontSize: 13,
                }}
              >
                Unable to load job data. This career may not be available in the
                BLS database.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: 12 }}>
              {/* Wage info */}
              <Card>
                <Row icon="dollar-sign" iconColor="#16A34A" title="Wage Information" colors={colors} />
                <Label colors={colors}>Median Annual Wage</Label>
                <Text
                  style={{
                    color: "#16A34A",
                    fontFamily: SYSTEM_FONT, fontWeight: "700",
                    fontSize: 24,
                  }}
                >
                  ${jobDataQ.data.medianAnnualWage.toLocaleString()}
                </Text>
                <Label colors={colors} mt={10}>
                  Hourly Wage
                </Label>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: SYSTEM_FONT, fontWeight: "600",
                    fontSize: 16,
                  }}
                >
                  ${jobDataQ.data.hourlyWage.toFixed(2)}/hour
                </Text>
                <Label colors={colors} mt={10}>
                  Data Year
                </Label>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: SYSTEM_FONT, fontWeight: "500",
                    fontSize: 13,
                  }}
                >
                  {jobDataQ.data.year}
                </Text>
              </Card>

              {/* Trend */}
              <Card>
                <Row icon="bar-chart-2" iconColor={colors.primary} title="Wage Trend" colors={colors} />
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Feather
                    name={trendIcon(jobDataQ.data.trend)}
                    size={16}
                    color={trendColor(jobDataQ.data.trend)}
                  />
                  <Text
                    style={{
                      color: trendColor(jobDataQ.data.trend),
                      fontFamily: SYSTEM_FONT, fontWeight: "700",
                      fontSize: 14,
                    }}
                  >
                    {jobDataQ.data.trend.charAt(0).toUpperCase() +
                      jobDataQ.data.trend.slice(1)}
                  </Text>
                </View>
                <Label colors={colors} mt={10}>
                  Year-over-Year Change
                </Label>
                <Text
                  style={{
                    color: trendColor(jobDataQ.data.trend),
                    fontFamily: SYSTEM_FONT, fontWeight: "700",
                    fontSize: 18,
                  }}
                >
                  {jobDataQ.data.trendPercentage > 0 ? "+" : ""}
                  {jobDataQ.data.trendPercentage}%
                </Text>
                <View
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor:
                      jobDataQ.data.trend === "rising"
                        ? "#DCFCE7"
                        : jobDataQ.data.trend === "declining"
                        ? "#FEE2E2"
                        : colors.muted,
                  }}
                >
                  <Text
                    style={{
                      color: trendColor(jobDataQ.data.trend),
                      fontFamily: SYSTEM_FONT, fontWeight: "600",
                      fontSize: 11,
                    }}
                  >
                    {trendBadge(jobDataQ.data.trend)}
                  </Text>
                </View>
              </Card>

              {/* Source */}
              <Card>
                <Row icon="clock" iconColor={colors.primary} title="Data Source" colors={colors} />
                <Label colors={colors}>BLS Series ID</Label>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: Platform.select({
                      ios: "Menlo",
                      android: "monospace",
                      default: "monospace",
                    }),
                    fontSize: 12,
                    backgroundColor: colors.muted,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    alignSelf: "flex-start",
                  }}
                >
                  {jobDataQ.data.seriesId}
                </Text>
                <Label colors={colors} mt={10}>
                  Career Title
                </Label>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: SYSTEM_FONT, fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {jobDataQ.data.career}
                </Text>
                <Label colors={colors} mt={10}>
                  Source
                </Label>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: SYSTEM_FONT, fontWeight: "400",
                    fontSize: 12,
                  }}
                >
                  OEWS — Occupational Employment and Wage Statistics
                </Text>
              </Card>
            </View>
          )
        ) : null}

        {/* STATES TAB */}
        {tab === "states" && selectedCareer ? (
          <View style={{ gap: 12 }}>
            {jobDataQ.data ? (
              <Card>
                <Row icon="users" iconColor={colors.primary} title="National Average" colors={colors} />
                <Label colors={colors}>Median Annual Wage</Label>
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: SYSTEM_FONT, fontWeight: "700",
                    fontSize: 22,
                  }}
                >
                  ${jobDataQ.data.medianAnnualWage.toLocaleString()}
                </Text>
                <Label colors={colors} mt={10}>
                  Career
                </Label>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: SYSTEM_FONT, fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {jobDataQ.data.career}
                </Text>
              </Card>
            ) : null}

            {stateDataQ.isLoading ? (
              <Card>
                <ActivityIndicator color={colors.primary} />
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: SYSTEM_FONT, fontWeight: "400",
                    fontSize: 12,
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  Loading state data…
                </Text>
              </Card>
            ) : stateDataQ.data ? (
              <Card>
                <Row icon="map-pin" iconColor="#16A34A" title={selectedStateLabel} colors={colors} />
                <Label colors={colors}>Median Annual Wage</Label>
                <Text
                  style={{
                    color: "#16A34A",
                    fontFamily: SYSTEM_FONT, fontWeight: "700",
                    fontSize: 22,
                  }}
                >
                  ${stateDataQ.data.medianAnnualWage.toLocaleString()}
                </Text>
                {jobDataQ.data ? (
                  <>
                    <Label colors={colors} mt={10}>
                      vs. National Average
                    </Label>
                    {(() => {
                      const diff =
                        stateDataQ.data.medianAnnualWage -
                        jobDataQ.data.medianAnnualWage;
                      const pct =
                        (diff / jobDataQ.data.medianAnnualWage) * 100;
                      const c =
                        diff > 0
                          ? "#16A34A"
                          : diff < 0
                          ? "#DC2626"
                          : colors.mutedForeground;
                      return (
                        <Text
                          style={{
                            color: c,
                            fontFamily: SYSTEM_FONT, fontWeight: "700",
                            fontSize: 16,
                          }}
                        >
                          {diff > 0 ? "+" : ""}${diff.toLocaleString()} (
                          {pct.toFixed(1)}%)
                        </Text>
                      );
                    })()}
                  </>
                ) : null}
              </Card>
            ) : (
              <Card>
                <Text
                  style={{
                    color: "#92400E",
                    fontFamily: SYSTEM_FONT, fontWeight: "500",
                    fontSize: 13,
                  }}
                >
                  State-specific data not available for this career in{" "}
                  {selectedStateLabel}.
                </Text>
              </Card>
            )}
          </View>
        ) : null}

        {/* SERIES TAB */}
        {tab === "series" ? (
          <View style={{ gap: 12 }}>
            <View>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: SYSTEM_FONT, fontWeight: "500",
                  fontSize: 13,
                  marginBottom: 6,
                }}
              >
                BLS Series ID
              </Text>
              <Input
                value={seriesIdInput}
                onChangeText={setSeriesIdInput}
                placeholder="e.g. OEUN000000000000151131"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT, fontWeight: "400",
                  fontSize: 11,
                  marginTop: 6,
                }}
              >
                Find series IDs at the BLS Time Series Catalog.
              </Text>
            </View>

            {seriesQ.isLoading ? (
              <Card>
                <ActivityIndicator color={colors.primary} />
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: SYSTEM_FONT, fontWeight: "400",
                    fontSize: 12,
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  Loading series data…
                </Text>
              </Card>
            ) : seriesQ.data && seriesQ.data.data?.length ? (
              <Card>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: SYSTEM_FONT, fontWeight: "700",
                    fontSize: 14,
                    marginBottom: 10,
                  }}
                >
                  Series Data: {seriesIdInput}
                </Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Label colors={colors}>Latest Value</Label>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: SYSTEM_FONT, fontWeight: "700",
                        fontSize: 16,
                      }}
                    >
                      {String(seriesQ.data.data[0]?.value ?? "—")}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label colors={colors}>Year</Label>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: SYSTEM_FONT, fontWeight: "700",
                        fontSize: 16,
                      }}
                    >
                      {seriesQ.data.data[0]?.year ?? "—"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label colors={colors}>Period</Label>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: SYSTEM_FONT, fontWeight: "700",
                        fontSize: 16,
                      }}
                    >
                      {seriesQ.data.data[0]?.period ?? "—"}
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: SYSTEM_FONT, fontWeight: "600",
                    fontSize: 13,
                    marginTop: 14,
                    marginBottom: 6,
                  }}
                >
                  Recent Data Points
                </Text>
                {seriesQ.data.data.slice(0, 5).map((p, i) => (
                  <View
                    key={`${p.year}-${p.period}-${i}`}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      backgroundColor: colors.muted,
                      borderRadius: 8,
                      marginTop: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: SYSTEM_FONT, fontWeight: "500",
                        fontSize: 12,
                      }}
                    >
                      {p.year} {p.period}
                    </Text>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: SYSTEM_FONT, fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {String(p.value)}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : seriesIdInput.length > 0 && seriesIdInput.length <= 10 ? (
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT, fontWeight: "400",
                  fontSize: 12,
                }}
              >
                Enter a full series ID to look it up.
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Empty state when no career selected */}
        {tab !== "series" && !selectedCareer && !careersQ.isLoading ? (
          <EmptyState
            icon="briefcase"
            title="Pick a career"
            message="Choose a career above to see live wages, trends, and state-by-state pay."
          />
        ) : null}
      </ScrollView>

      {/* Career picker modal */}
      <Modal
        visible={careerPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCareerPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCareerPickerOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.modalSheet,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: SYSTEM_FONT, fontWeight: "700",
                  fontSize: 16,
                }}
              >
                Select a career
              </Text>
              <Pressable onPress={() => setCareerPickerOpen(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 480 }}>
              {careers.map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => {
                    setSelectedCareer(c.key);
                    setCareerPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.modalRow,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: pressed ? colors.muted : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: SYSTEM_FONT, fontWeight: c.key === selectedCareer ? "700" : "500",
                      fontSize: 14,
                      flex: 1,
                    }}
                  >
                    {c.title}
                  </Text>
                  {c.key === selectedCareer ? (
                    <Feather name="check" size={16} color={colors.primary} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* State picker modal */}
      <Modal
        visible={statePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setStatePickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setStatePickerOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.modalSheet,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: SYSTEM_FONT, fontWeight: "700",
                  fontSize: 16,
                }}
              >
                Select a state
              </Text>
              <Pressable onPress={() => setStatePickerOpen(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 480 }}>
              {US_STATES.map((s) => (
                <Pressable
                  key={s.code}
                  onPress={() => {
                    setSelectedState(s.code);
                    setStatePickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.modalRow,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: pressed ? colors.muted : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: SYSTEM_FONT, fontWeight: s.code === selectedState ? "700" : "500",
                      fontSize: 14,
                      flex: 1,
                    }}
                  >
                    {s.name}
                  </Text>
                  {s.code === selectedState ? (
                    <Feather name="check" size={16} color={colors.primary} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Row({
  icon,
  iconColor,
  title,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  iconColor: string;
  title: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 10,
      }}
    >
      <Feather name={icon} size={16} color={iconColor} />
      <Text
        style={{
          color: colors.foreground,
          fontFamily: SYSTEM_FONT, fontWeight: "700",
          fontSize: 14,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function Label({
  colors,
  children,
  mt = 0,
}: {
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
  mt?: number;
}) {
  return (
    <Text
      style={{
        color: colors.mutedForeground,
        fontFamily: SYSTEM_FONT, fontWeight: "500",
        fontSize: 11,
        marginTop: mt,
        marginBottom: 2,
      }}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  selectField: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "75%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
});
