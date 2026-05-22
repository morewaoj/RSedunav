import { Platform, type TextStyle } from "react-native";

export const SYSTEM_FONT = Platform.select({
  ios: "System",
  android: "Roboto",
  default: "System",
});

type Weight = TextStyle["fontWeight"];

export const FW: Record<"regular" | "medium" | "semibold" | "bold", Weight> = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};
