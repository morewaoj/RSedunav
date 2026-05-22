import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { SYSTEM_FONT } from "@/lib/typography";

type Props = TextInputProps & {
  label?: string;
  error?: string;
  isPassword?: boolean;
};

export function Input({ label, error, isPassword, style, ...rest }: Props) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text
          style={[
            styles.label,
            { color: colors.foreground, fontFamily: SYSTEM_FONT, fontWeight: "500" },
          ]}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: focused ? colors.card : colors.muted,
            borderColor: error
              ? colors.destructive
              : focused
                ? colors.primary
                : colors.border,
            borderRadius: colors.radius - 2,
          },
        ]}
      >
        <TextInput
          {...rest}
          secureTextEntry={isPassword && !revealed}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { color: colors.foreground, fontFamily: SYSTEM_FONT, fontWeight: "400" },
            style,
          ]}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <Feather
              name={revealed ? "eye-off" : "eye"}
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          style={[
            styles.errorText,
            { color: colors.destructive, fontFamily: SYSTEM_FONT, fontWeight: "400" },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontSize: 13,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  iconBtn: {
    padding: 4,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 12,
    marginTop: 2,
  },
});
