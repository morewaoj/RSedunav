import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { SYSTEM_FONT } from "@/lib/typography";

type Option = string | { label: string; value: string };

function normalize(opt: Option): { label: string; value: string } {
  return typeof opt === "string" ? { label: opt, value: opt } : opt;
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "Select…",
  searchable = true,
  max,
}: {
  label?: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  max?: number;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalized = useMemo(() => options.map(normalize), [options]);
  const selectedLabels = useMemo(
    () =>
      selected
        .map((v) => normalized.find((o) => o.value === v)?.label ?? v)
        .filter(Boolean),
    [selected, normalized],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return normalized;
    const q = query.trim().toLowerCase();
    return normalized.filter((o) => o.label.toLowerCase().includes(q));
  }, [normalized, query]);

  const summary =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2} more`;

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      if (typeof max === "number" && selected.length >= max) return;
      onChange([...selected, value]);
    }
  };

  return (
    <View>
      {label ? (
        <Text
          style={{
            color: colors.foreground,
            fontFamily: SYSTEM_FONT,
            fontWeight: "600",
            fontSize: 13,
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: colors.muted,
            borderColor: colors.border,
            borderRadius: colors.radius,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={2}
            style={{
              color:
                selectedLabels.length === 0
                  ? colors.mutedForeground
                  : colors.foreground,
              fontFamily: SYSTEM_FONT,
              fontWeight: selectedLabels.length === 0 ? "400" : "500",
              fontSize: 14,
            }}
          >
            {summary}
          </Text>
          {selectedLabels.length > 0 ? (
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT,
                fontWeight: "400",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              {selectedLabels.length} selected
              {typeof max === "number" ? ` · max ${max}` : ""}
            </Text>
          ) : null}
        </View>
        <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView
          edges={["top", "bottom"]}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.border },
            ]}
          >
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT,
                  fontWeight: "500",
                  fontSize: 15,
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Text
              style={{
                color: colors.foreground,
                fontFamily: SYSTEM_FONT,
                fontWeight: "700",
                fontSize: 16,
              }}
            >
              {label ?? "Select"}
            </Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: SYSTEM_FONT,
                  fontWeight: "700",
                  fontSize: 15,
                }}
              >
                Done
              </Text>
            </Pressable>
          </View>

          {searchable ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 4,
              }}
            >
              <View
                style={[
                  styles.search,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Feather
                  name="search"
                  size={16}
                  color={colors.mutedForeground}
                />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search…"
                  placeholderTextColor={colors.mutedForeground}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    color: colors.foreground,
                    fontFamily: SYSTEM_FONT,
                    fontWeight: "400",
                    fontSize: 15,
                  }}
                />
                {query.length > 0 ? (
                  <Pressable onPress={() => setQuery("")} hitSlop={8}>
                    <Feather
                      name="x"
                      size={16}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {selected.length > 0 ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: 4,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT,
                  fontWeight: "500",
                  fontSize: 12,
                }}
              >
                {selected.length} selected
                {typeof max === "number" ? ` · max ${max}` : ""}
              </Text>
              <Pressable onPress={() => onChange([])} hitSlop={8}>
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: SYSTEM_FONT,
                    fontWeight: "600",
                    fontSize: 12,
                  }}
                >
                  Clear all
                </Text>
              </Pressable>
            </View>
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            contentContainerStyle={{ paddingVertical: 8 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = selected.includes(item.value);
              const reachedMax =
                typeof max === "number" &&
                selected.length >= max &&
                !isSelected;
              return (
                <Pressable
                  onPress={() => !reachedMax && toggle(item.value)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: pressed
                        ? colors.muted
                        : "transparent",
                      opacity: reachedMax ? 0.4 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: isSelected
                          ? colors.primary
                          : colors.border,
                        backgroundColor: isSelected
                          ? colors.primary
                          : "transparent",
                      },
                    ]}
                  >
                    {isSelected ? (
                      <Feather name="check" size={14} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      color: colors.foreground,
                      fontFamily: SYSTEM_FONT,
                      fontWeight: isSelected ? "600" : "400",
                      fontSize: 15,
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: 32, alignItems: "center" }}>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: SYSTEM_FONT,
                    fontWeight: "400",
                    fontSize: 14,
                  }}
                >
                  No matches.
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export function SingleSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchable = true,
}: {
  label?: string;
  options: Option[];
  value: string | null | undefined;
  onChange: (next: string) => void;
  placeholder?: string;
  searchable?: boolean;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalized = useMemo(() => options.map(normalize), [options]);
  const currentLabel =
    normalized.find((o) => o.value === value)?.label ?? "";

  const filtered = useMemo(() => {
    if (!query.trim()) return normalized;
    const q = query.trim().toLowerCase();
    return normalized.filter((o) => o.label.toLowerCase().includes(q));
  }, [normalized, query]);

  return (
    <View>
      {label ? (
        <Text
          style={{
            color: colors.foreground,
            fontFamily: SYSTEM_FONT,
            fontWeight: "600",
            fontSize: 13,
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
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
            flex: 1,
            color: currentLabel ? colors.foreground : colors.mutedForeground,
            fontFamily: SYSTEM_FONT,
            fontWeight: currentLabel ? "500" : "400",
            fontSize: 14,
          }}
        >
          {currentLabel || placeholder}
        </Text>
        <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView
          edges={["top", "bottom"]}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.border },
            ]}
          >
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT,
                  fontWeight: "500",
                  fontSize: 15,
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Text
              style={{
                color: colors.foreground,
                fontFamily: SYSTEM_FONT,
                fontWeight: "700",
                fontSize: 16,
              }}
            >
              {label ?? "Select"}
            </Text>
            <View style={{ width: 50 }} />
          </View>

          {searchable ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 4,
              }}
            >
              <View
                style={[
                  styles.search,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Feather
                  name="search"
                  size={16}
                  color={colors.mutedForeground}
                />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search…"
                  placeholderTextColor={colors.mutedForeground}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    color: colors.foreground,
                    fontFamily: SYSTEM_FONT,
                    fontWeight: "400",
                    fontSize: 15,
                  }}
                />
              </View>
            </View>
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            contentContainerStyle={{ paddingVertical: 8 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: pressed
                        ? colors.muted
                        : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: colors.foreground,
                      fontFamily: SYSTEM_FONT,
                      fontWeight: isSelected ? "700" : "400",
                      fontSize: 15,
                    }}
                  >
                    {item.label}
                  </Text>
                  {isSelected ? (
                    <Feather
                      name="check"
                      size={18}
                      color={colors.primary}
                    />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    minHeight: 48,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
