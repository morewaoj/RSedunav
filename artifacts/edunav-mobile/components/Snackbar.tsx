import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { SYSTEM_FONT } from "@/lib/typography";

type SnackbarProps = {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs?: number;
};

export function Snackbar({
  visible,
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 5000,
}: SnackbarProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hold the latest onDismiss in a ref so a new arrow-function reference from
  // the parent on each re-render doesn't reset the auto-dismiss timer.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }

    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
      dismissTimer.current = setTimeout(() => {
        onDismissRef.current();
      }, durationMs);
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(translateY, {
          toValue: 20,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    }

    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
    };
  }, [visible, durationMs, opacity, translateY]);

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 24,
        alignItems: "center",
        paddingHorizontal: 16,
      }}
    >
      <Animated.View
        style={{
          opacity,
          transform: [{ translateY }],
          maxWidth: 480,
          width: "100%",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.foreground,
          borderRadius: colors.radius,
          paddingVertical: 12,
          paddingHorizontal: 16,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <Text
          style={{
            flex: 1,
            color: colors.background,
            fontFamily: SYSTEM_FONT,
            fontWeight: "500",
            fontSize: 14,
          }}
          numberOfLines={2}
        >
          {message}
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ pressed }) => ({
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: colors.primary,
                fontFamily: SYSTEM_FONT,
                fontWeight: "700",
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}
