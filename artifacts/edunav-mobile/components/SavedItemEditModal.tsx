import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useColors } from "@/hooks/useColors";
import { SYSTEM_FONT } from "@/lib/typography";

export type CollegePriority = "high" | "medium" | "low";

export const COLLEGE_PRIORITIES: Array<{ value: CollegePriority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export type ScholarshipStatus = "interested" | "applied" | "awarded" | "rejected";

export const SCHOLARSHIP_STATUSES: Array<{ value: ScholarshipStatus; label: string }> = [
  { value: "interested", label: "Interested" },
  { value: "applied", label: "Applied" },
  { value: "awarded", label: "Awarded" },
  { value: "rejected", label: "Rejected" },
];

export function isCollegePriority(v: unknown): v is CollegePriority {
  return v === "high" || v === "medium" || v === "low";
}

export function isScholarshipStatus(v: unknown): v is ScholarshipStatus {
  return v === "interested" || v === "applied" || v === "awarded" || v === "rejected";
}

export function priorityLabel(v: unknown): string | null {
  if (!isCollegePriority(v)) return null;
  return COLLEGE_PRIORITIES.find((p) => p.value === v)?.label ?? null;
}

export function statusLabel(v: unknown): string | null {
  if (!isScholarshipStatus(v)) return null;
  return SCHOLARSHIP_STATUSES.find((s) => s.value === v)?.label ?? null;
}

export function normalizeNotes(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export type CollegeEditTarget = {
  kind: "college";
  rowId: number;
  label: string;
  notes: string;
  priority: CollegePriority;
  originalNotes: string | null;
  originalPriority: CollegePriority | null;
};

export type ScholarshipEditTarget = {
  kind: "scholarship";
  rowId: number;
  label: string;
  notes: string;
  status: ScholarshipStatus;
  originalNotes: string | null;
  originalStatus: ScholarshipStatus | null;
};

export type CareerEditTarget = {
  kind: "career";
  rowId: number;
  label: string;
  notes: string;
  originalNotes: string | null;
};

export type EditTarget = CollegeEditTarget | ScholarshipEditTarget | CareerEditTarget;

export function EditModal({
  target,
  onCancel,
  onChange,
  onSave,
  isSaving,
}: {
  target: EditTarget | null;
  onCancel: () => void;
  onChange: (next: EditTarget) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const colors = useColors();
  // Sync local notes immediately to parent so onSave reads the latest value.
  const [notesDraft, setNotesDraft] = useState("");
  const notesInputRef = useRef<TextInput>(null);
  // Captures whether the modal opened with an empty note, so onShow can
  // decide whether to auto-focus the notes input (Add a note flow) without
  // stealing focus when the user is just reading an existing note.
  const focusOnShowRef = useRef(false);

  useEffect(() => {
    const initialNotes = target?.notes ?? "";
    setNotesDraft(initialNotes);
    focusOnShowRef.current = Boolean(target) && initialNotes === "";
  }, [target?.kind, target?.rowId]);

  const handleModalShow = () => {
    if (focusOnShowRef.current) {
      notesInputRef.current?.focus();
    }
  };

  if (!target) return null;

  const updateNotes = (next: string) => {
    setNotesDraft(next);
    onChange({ ...target, notes: next });
  };

  const title =
    target.kind === "college"
      ? "Edit college"
      : target.kind === "scholarship"
        ? "Edit scholarship"
        : "Edit career";

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      onRequestClose={onCancel}
      onShow={handleModalShow}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <Pressable
          accessibilityLabel="Close editor"
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: colors.radius + 6,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
            gap: 16,
          }}
        >
          <View>
            <Text
              style={{
                color: colors.foreground,
                fontFamily: SYSTEM_FONT,
                fontWeight: "700",
                fontSize: 17,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT,
                fontWeight: "400",
                fontSize: 13,
                marginTop: 2,
              }}
              numberOfLines={2}
            >
              {target.label}
            </Text>
          </View>

          {target.kind === "college" ? (
            <View style={{ gap: 8 }}>
              <Text style={editStyles.fieldLabel(colors.foreground)}>
                Priority
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {COLLEGE_PRIORITIES.map((p) => {
                  const active = target.priority === p.value;
                  return (
                    <Pressable
                      key={p.value}
                      onPress={() => onChange({ ...target, priority: p.value })}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: colors.radius,
                        borderWidth: 1,
                        alignItems: "center",
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? colors.primaryForeground : colors.foreground,
                          fontFamily: SYSTEM_FONT,
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : target.kind === "scholarship" ? (
            <View style={{ gap: 8 }}>
              <Text style={editStyles.fieldLabel(colors.foreground)}>
                Application status
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {SCHOLARSHIP_STATUSES.map((s) => {
                  const active = target.status === s.value;
                  return (
                    <Pressable
                      key={s.value}
                      onPress={() => onChange({ ...target, status: s.value })}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: colors.radius,
                        borderWidth: 1,
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? colors.primaryForeground : colors.foreground,
                          fontFamily: SYSTEM_FONT,
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={editStyles.fieldLabel(colors.foreground)}>Notes</Text>
              {notesDraft.length > 0 ? (
                <Pressable
                  onPress={() => updateNotes("")}
                  disabled={isSaving}
                  accessibilityLabel="Clear note"
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: colors.radius - 2,
                    backgroundColor: pressed ? colors.muted : "transparent",
                    opacity: isSaving ? 0.5 : 1,
                  })}
                >
                  <Feather name="trash-2" size={13} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: SYSTEM_FONT,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    Clear note
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <TextInput
              ref={notesInputRef}
              value={notesDraft}
              onChangeText={updateNotes}
              placeholder="Why is this on your plan? Add reminders or next steps."
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={2000}
              textAlignVertical="top"
              style={{
                minHeight: 110,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: colors.radius - 2,
                backgroundColor: colors.muted,
                color: colors.foreground,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontFamily: SYSTEM_FONT,
                fontWeight: "400",
                fontSize: 14,
              }}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <PrimaryButton
              label="Cancel"
              variant="secondary"
              onPress={onCancel}
              disabled={isSaving}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label="Save"
              onPress={onSave}
              loading={isSaving}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const editStyles = {
  fieldLabel: (color: string) => ({
    color,
    fontFamily: SYSTEM_FONT,
    fontWeight: "600" as const,
    fontSize: 13,
  }),
};
