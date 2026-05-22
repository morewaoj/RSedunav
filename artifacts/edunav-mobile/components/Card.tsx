import React from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Card({ children, onPress, style }: Props) {
  const colors = useColors();
  const baseStyle = [
    styles.card,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: colors.radius + 4,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...baseStyle,
          pressed ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={baseStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    boxShadow: "0px 1px 6px rgba(0, 0, 0, 0.04)",
    elevation: 1,
  },
});
