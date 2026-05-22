import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { SYSTEM_FONT } from "@/lib/typography";

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: Props) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: SYSTEM_FONT, fontWeight: "700" },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.subtitle,
              {
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT, fontWeight: "400",
              },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text
            style={{
              color: colors.primary,
              fontFamily: SYSTEM_FONT, fontWeight: "600",
              fontSize: 14,
            }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
