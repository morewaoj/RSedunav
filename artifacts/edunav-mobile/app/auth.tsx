import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useColors } from "@/hooks/useColors";
import { getApiBase } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SYSTEM_FONT } from "@/lib/typography";

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [submitting, setSubmitting] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const openLegal = async (path: string) => {
    try {
      const url = `${getApiBase()}${path}`;
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert("Couldn't open link", "Please try again.");
    }
  };

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      Alert.alert("Missing fields", "Please enter a username and password.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      Alert.alert("Password mismatch", "The passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(username.trim(), password);
      } else {
        await signUp({
          username: username.trim(),
          password,
          email: email.trim() || undefined,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
        });
      }
      router.replace("/(tabs)");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      const friendly = msg.includes("401")
        ? "Invalid username or password."
        : msg.includes("400")
          ? "Username already exists or input is invalid."
          : "Could not connect to the server. Please try again.";
      Alert.alert(mode === "signin" ? "Sign in failed" : "Sign up failed", friendly);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandWrap}>
            <Logo size={60} />
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius + 4,
              },
            ]}
          >
            <Text
              style={[
                styles.cardTitle,
                { color: colors.foreground, fontFamily: SYSTEM_FONT, fontWeight: "700" },
              ]}
            >
              {mode === "signin"
                ? "Sign in to your account"
                : "Create your account"}
            </Text>
            <Text
              style={[
                styles.cardSub,
                {
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT, fontWeight: "400",
                },
              ]}
            >
              {mode === "signin"
                ? "Enter your credentials to continue"
                : "Get started with personalized career guidance"}
            </Text>

            <View style={{ gap: 14, marginTop: 18 }}>
              {mode === "signup" ? (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="First name"
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                      autoComplete="given-name"
                      placeholder="Jane"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Last name"
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                      autoComplete="family-name"
                      placeholder="Doe"
                    />
                  </View>
                </View>
              ) : null}

              {mode === "signup" ? (
                <Input
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              ) : null}

              <Input
                label="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username"
                placeholder="Enter your username"
              />
              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                isPassword
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                placeholder="Enter your password"
              />
              {mode === "signup" ? (
                <Input
                  label="Confirm password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  isPassword
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                />
              ) : null}

              {mode === "signup" ? (
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: SYSTEM_FONT,
                    fontWeight: "400",
                    fontSize: 12,
                    lineHeight: 18,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  By creating an account, you agree to our{" "}
                  <Text
                    onPress={() => openLegal("/terms")}
                    style={{
                      color: colors.primary,
                      fontFamily: SYSTEM_FONT,
                      fontWeight: "500",
                    }}
                  >
                    Terms of Service
                  </Text>
                  {" "}and{" "}
                  <Text
                    onPress={() => openLegal("/privacy")}
                    style={{
                      color: colors.primary,
                      fontFamily: SYSTEM_FONT,
                      fontWeight: "500",
                    }}
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
              ) : null}

              <PrimaryButton
                label={mode === "signin" ? "Sign In" : "Create Account"}
                onPress={handleSubmit}
                loading={submitting}
                style={{ marginTop: 4 }}
              />
            </View>

            <View
              style={[
                styles.divider,
                { backgroundColor: colors.border },
              ]}
            />
            <View style={styles.toggleRow}>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT, fontWeight: "400",
                  fontSize: 14,
                }}
              >
                {mode === "signin"
                  ? "Don't have an account? "
                  : "Already have an account? "}
              </Text>
              <Pressable
                onPress={() =>
                  setMode(mode === "signin" ? "signup" : "signin")
                }
                hitSlop={6}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: SYSTEM_FONT, fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.footer}>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT, fontWeight: "400",
                fontSize: 12,
              }}
            >
              Careers  ·  Colleges  ·  Scholarships
            </Text>
            <View style={styles.legalRow}>
              <LegalLink label="Privacy Policy" path="/privacy" />
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT,
                  fontWeight: "400",
                  fontSize: 12,
                }}
              >
                {"  ·  "}
              </Text>
              <LegalLink label="Support" path="/support" />
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT,
                  fontWeight: "400",
                  fontSize: 12,
                }}
              >
                {"  ·  "}
              </Text>
              <LegalLink label="Terms of Service" path="/terms" />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    minHeight: "100%",
  },
  brandWrap: {
    alignItems: "center",
    marginBottom: 24,
    marginTop: 12,
  },
  card: {
    borderWidth: 1,
    padding: 24,
    boxShadow: "0px 4px 18px rgba(0, 0, 0, 0.06)",
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    textAlign: "center",
  },
  cardSub: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  divider: {
    height: 1,
    marginVertical: 18,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    marginTop: 28,
    alignItems: "center",
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexWrap: "wrap",
  },
});

function LegalLink({ label, path }: { label: string; path: string }) {
  const colors = useColors();
  const handlePress = async () => {
    try {
      const url = `${getApiBase()}${path}`;
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert("Couldn't open link", "Please try again.");
    }
  };
  return (
    <Pressable onPress={handlePress} hitSlop={8}>
      <Text
        style={{
          color: colors.primary,
          fontFamily: SYSTEM_FONT,
          fontWeight: "500",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
