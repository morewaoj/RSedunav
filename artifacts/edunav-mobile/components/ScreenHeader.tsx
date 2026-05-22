import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { SYSTEM_FONT } from "@/lib/typography";

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showBack?: boolean;
};

export function ScreenHeader({ title, subtitle, right, showBack }: Props) {
  const colors = useColors();
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <View style={styles.wrap}>
      {showBack ? (
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          style={({ pressed }) => [
            styles.backBtn,
            {
              backgroundColor: pressed ? colors.muted : "transparent",
              borderColor: colors.border,
            },
          ]}
        >
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </Pressable>
      ) : null}
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
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
  },
  title: {
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
});
