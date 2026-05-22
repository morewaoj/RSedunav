import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { SYSTEM_FONT } from "@/lib/typography";

const logo = require("../assets/images/edunav-logo.png");

type Props = {
  size?: number;
  showWordmark?: boolean;
};

export function Logo({ size = 56, showWordmark = true }: Props) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <Image
        source={logo}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      {showWordmark ? (
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: SYSTEM_FONT, fontWeight: "700" },
          ]}
        >
          RS EduNav
        </Text>
      ) : null}
      {showWordmark ? (
        <Text
          style={[
            styles.subtitle,
            {
              color: colors.mutedForeground,
              fontFamily: SYSTEM_FONT, fontWeight: "400",
            },
          ]}
        >
          Educational Intelligence
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 24,
    letterSpacing: -0.4,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 13,
  },
});
