import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { SYSTEM_FONT } from "@/lib/typography";

type Props = {
  label: string;
  onPress: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
  testID?: string;
};

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  style,
  testID,
}: Props) {
  const colors = useColors();
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    void onPress();
  };

  if (variant === "primary") {
    return (
      <Pressable
        testID={testID}
        onPress={handlePress}
        disabled={isDisabled}
        style={({ pressed }) => [
          { borderRadius: colors.radius, overflow: "hidden" },
          pressed && !isDisabled ? { opacity: 0.92 } : null,
          isDisabled ? { opacity: 0.5 } : null,
          style,
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBtn}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text
              style={[
                styles.label,
                { color: colors.primaryForeground },
              ]}
            >
              {label}
            </Text>
          )}
        </LinearGradient>
      </Pressable>
    );
  }

  if (variant === "secondary") {
    return (
      <Pressable
        testID={testID}
        onPress={handlePress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.secondaryBtn,
          {
            borderRadius: colors.radius,
            backgroundColor: colors.secondary,
            borderColor: colors.border,
          },
          pressed && !isDisabled ? { opacity: 0.85 } : null,
          isDisabled ? { opacity: 0.5 } : null,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.foreground} />
        ) : (
          <Text style={[styles.label, { color: colors.foreground }]}>
            {label}
          </Text>
        )}
      </Pressable>
    );
  }

  // ghost
  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.ghostBtn,
        pressed && !isDisabled ? { opacity: 0.7 } : null,
        isDisabled ? { opacity: 0.5 } : null,
        style,
      ]}
    >
      <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gradientBtn: {
    minHeight: 48,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    minHeight: 48,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  ghostBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: SYSTEM_FONT, fontWeight: "600",
    fontSize: 15,
  },
});

export function GradientText({
  text,
  style,
}: {
  text: string;
  style?: { fontSize?: number; fontFamily?: string };
}) {
  // Approximation: expo-linear-gradient can't mask text easily without MaskedView.
  // Use solid primary color instead — keeps brand intact without extra deps.
  const colors = useColors();
  return (
    <View>
      <Text
        style={{
          color: colors.primary,
          fontFamily: style?.fontFamily ?? SYSTEM_FONT,
          fontWeight: "700",
          fontSize: style?.fontSize ?? 24,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
