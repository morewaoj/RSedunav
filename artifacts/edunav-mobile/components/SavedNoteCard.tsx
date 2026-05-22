import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { useColors } from "@/hooks/useColors";
import { SYSTEM_FONT } from "@/lib/typography";

export function SavedNoteCard({
  note,
  onEdit,
  disabled,
}: {
  note: string | null;
  onEdit: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();

  if (!note) {
    return (
      <Pressable
        onPress={onEdit}
        disabled={disabled}
        accessibilityLabel="Add a note"
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: colors.radius,
          borderWidth: 1,
          borderColor: colors.border,
          borderStyle: "dashed",
          backgroundColor: pressed ? colors.muted : "transparent",
          opacity: disabled ? 0.5 : 1,
        })}
      >
        <Feather name="plus" size={14} color={colors.primary} />
        <Text
          style={{
            color: colors.primary,
            fontFamily: SYSTEM_FONT,
            fontWeight: "600",
            fontSize: 13,
          }}
        >
          Add a note
        </Text>
      </Pressable>
    );
  }

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Feather name="edit-3" size={14} color={colors.primary} />
        <Text
          style={{
            color: colors.foreground,
            fontFamily: SYSTEM_FONT,
            fontWeight: "700",
            fontSize: 15,
            flex: 1,
          }}
        >
          Your note
        </Text>
        <Pressable
          onPress={onEdit}
          disabled={disabled}
          accessibilityLabel="Edit your note"
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => ({
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: colors.radius - 2,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: pressed ? colors.muted : "transparent",
            opacity: disabled ? 0.5 : 1,
          })}
        >
          <Feather name="edit-2" size={13} color={colors.primary} />
          <Text
            style={{
              color: colors.primary,
              fontFamily: SYSTEM_FONT,
              fontWeight: "600",
              fontSize: 13,
            }}
          >
            Edit note
          </Text>
        </Pressable>
      </View>
      <Text
        style={{
          color: colors.foreground,
          fontFamily: SYSTEM_FONT,
          fontWeight: "400",
          fontSize: 14,
          lineHeight: 21,
          marginTop: 8,
        }}
      >
        {note}
      </Text>
    </Card>
  );
}
