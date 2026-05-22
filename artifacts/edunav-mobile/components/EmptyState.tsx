import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { SYSTEM_FONT } from "@/lib/typography";

type Props = {
  icon?: React.ComponentProps<typeof Feather>["name"];
  title: string;
  message?: string;
};

export function EmptyState({ icon = "inbox", title, message }: Props) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: colors.accent,
            borderRadius: 999,
          },
        ]}
      >
        <Feather name={icon} size={28} color={colors.primary} />
      </View>
      <Text
        style={[
          styles.title,
          { color: colors.foreground, fontFamily: SYSTEM_FONT, fontWeight: "600" },
        ]}
      >
        {title}
      </Text>
      {message ? (
        <Text
          style={[
            styles.msg,
            {
              color: colors.mutedForeground,
              fontFamily: SYSTEM_FONT, fontWeight: "400",
            },
          ]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
  },
  msg: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
