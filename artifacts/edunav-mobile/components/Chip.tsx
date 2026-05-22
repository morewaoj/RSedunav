import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { SYSTEM_FONT } from "@/lib/typography";

export function Chip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={disabled && !selected ? undefined : onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.muted,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled && !selected ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {selected ? (
        <Feather name="check" size={12} color="#FFFFFF" />
      ) : null}
      <Text
        style={{
          color: selected ? "#FFFFFF" : colors.foreground,
          fontFamily: SYSTEM_FONT, fontWeight: selected ? "600" : "500",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipGroup({
  options,
  selected,
  onToggle,
  max,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  max?: number;
}) {
  return (
    <View style={styles.group}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        const reachedMax =
          typeof max === "number" && selected.length >= max && !isSelected;
        return (
          <Chip
            key={opt}
            label={opt}
            selected={isSelected}
            disabled={reachedMax}
            onPress={() => onToggle(opt)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  group: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
