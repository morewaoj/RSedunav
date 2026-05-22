import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";
import { SYSTEM_FONT } from "@/lib/typography";

type Props = {
  style?: StyleProp<ViewStyle>;
};

export function SavedBadge({ style }: Props) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Saved to your plan"
      style={[
        styles.badge,
        { backgroundColor: colors.primary, borderColor: colors.primary },
        style,
      ]}
    >
      <Feather name="check" size={11} color="#FFFFFF" />
      <Text style={styles.label}>Saved</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  label: {
    color: "#FFFFFF",
    fontFamily: SYSTEM_FONT,
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
