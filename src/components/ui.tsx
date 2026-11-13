import React, { createContext, useContext, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  I18nManager,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export const C = {
  ink: "#193C35",
  muted: "#6A7C74",
  green: "#226B53",
  mint: "#E7F0E8",
  cream: "#F6F5EF",
  white: "#FFFFFF",
  line: "#E3E7DF",
  gold: "#B3904F",
  paleGold: "#F6EEDC",
  red: "#B14141",
  redBg: "#FAEEEE",
};
export const PrivacyContext = createContext(true);
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function Icon({
  name,
  size = 22,
  color = C.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Txt({
  children,
  style,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text {...props} style={[U.text, style]}>
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  icon,
  kind = "primary",
  busy = false,
  disabled = false,
  small = false,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  kind?: "primary" | "secondary" | "danger" | "ghost";
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const bg = {
    primary: C.green,
    secondary: C.mint,
    danger: C.redBg,
    ghost: "transparent",
  }[kind];
  const color =
    kind === "primary" ? C.white : kind === "danger" ? C.red : C.green;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        U.button,
        {
          backgroundColor: bg,
          opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
          paddingVertical: small ? 10 : 15,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : icon ? (
        <Icon name={icon} size={small ? 17 : 21} color={color} />
      ) : null}
      <Txt style={{ color, fontWeight: "700", fontSize: small ? 12 : 14 }}>
        {title}
      </Txt>
    </Pressable>
  );
}
export function Field({
  label,
  required,
  hint,
  ...props
}: TextInputProps & { label: string; required?: boolean; hint?: string }) {
  return (
    <View style={{ gap: 7, marginBottom: 15 }}>
      <Txt style={U.label}>
        {label}
        {required ? " *" : ""}
      </Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#99A49E"
        {...props}
        style={[
          U.input,
          props.multiline ? { height: 100, textAlignVertical: "top" } : null,
          props.style,
        ]}
      />
      {hint ? <Txt style={{ fontSize: 11, color: C.muted }}>{hint}</Txt> : null}
    </View>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[U.card, style]}>{children}</View>;
}
export function Badge({
  text,
  tone = "green",
}: {
  text: string;
  tone?: "green" | "gold" | "red";
}) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 7,
        backgroundColor:
          tone === "green" ? C.mint : tone === "gold" ? C.paleGold : C.redBg,
        alignSelf: "flex-start",
      }}
    >
      <Txt
        style={{
          fontSize: 10,
          color: tone === "red" ? C.red : tone === "gold" ? "#886D35" : C.green,
          fontWeight: "700",
        }}
      >
        {text}
      </Txt>
    </View>
  );
}
export function Section({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View
      style={[U.row, { justifyContent: "space-between", marginBottom: 14 }]}
    >
      <View style={{ flex: 1 }}>
        <Txt style={U.h2}>{title}</Txt>
        {subtitle ? <Txt style={U.caption}>{subtitle}</Txt> : null}
      </View>
      {action}
    </View>
  );
}
export function Empty({
  icon = "file-tray-outline",
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card style={{ paddingVertical: 35, alignItems: "center", gap: 13 }}>
      <View style={U.emptyIcon}>
        <Icon name={icon} size={30} color={C.green} />
      </View>
      <Txt style={[U.h2, { textAlign: "center" }]}>{title}</Txt>
      <Txt style={[U.caption, { textAlign: "center", lineHeight: 23 }]}>
        {body}
      </Txt>
      {action}
    </Card>
  );
}
export function Notice({
  children,
  danger = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: danger ? C.redBg : C.paleGold,
        padding: 14,
        borderRadius: 12,
        marginBottom: 15,
      }}
    >
      <Txt
        accessibilityRole={danger ? "alert" : "text"}
        style={{
          color: danger ? C.red : "#81622C",
          fontSize: 12,
          lineHeight: 21,
        }}
      >
        {children}
      </Txt>
    </View>
  );
}
export function Page({
  children,
  title,
  kicker,
  action,
}: {
  children: React.ReactNode;
  title: string;
  kicker?: string;
  action?: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [opacity]);
  return (
    <Animated.View style={{ flex: 1, opacity }}>
      <ScrollView
        contentContainerStyle={U.page}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[U.row, { justifyContent: "space-between", marginBottom: 25 }]}
        >
          <View style={{ flex: 1 }}>
            {kicker ? <Txt style={U.kicker}>{kicker}</Txt> : null}
            <Txt style={U.h1}>{title}</Txt>
          </View>
          {action}
        </View>
        {children}
      </ScrollView>
    </Animated.View>
  );
}
export function Sheet({
  visible,
  title,
  onClose,
  children,
  busy = false,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  busy?: boolean;
}) {
  const inset = useSafeAreaInsets();
  const unlocked = useContext(PrivacyContext);
  return (
    <Modal
      visible={visible && unlocked}
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
      presentationStyle="fullScreen"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          backgroundColor: C.cream,
          paddingTop: inset.top,
          paddingBottom: inset.bottom,
        }}
      >
        <View
          style={[
            U.row,
            {
              justifyContent: "space-between",
              padding: 20,
              borderBottomWidth: 1,
              borderColor: C.line,
            },
          ]}
        >
          <Txt style={U.h2}>{title}</Txt>
          <Pressable
            disabled={busy}
            accessibilityLabel="إغلاق"
            accessibilityRole="button"
            onPress={onClose}
            style={U.iconButton}
          >
            <Icon name="close" />
          </Pressable>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 22, paddingBottom: 50 }}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function Choice({
  title,
  selected,
  onPress,
  subtitle,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  subtitle?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        U.row,
        {
          padding: 14,
          borderWidth: 1,
          borderColor: selected ? C.green : C.line,
          backgroundColor: selected ? C.mint : C.white,
          borderRadius: 12,
          marginBottom: 8,
        },
      ]}
    >
      <Icon
        name={selected ? "radio-button-on" : "radio-button-off"}
        color={selected ? C.green : C.muted}
      />
      <View style={{ flex: 1 }}>
        <Txt style={{ fontWeight: "700" }}>{title}</Txt>
        {subtitle ? <Txt style={U.caption}>{subtitle}</Txt> : null}
      </View>
    </Pressable>
  );
}
export const U = StyleSheet.create({
  text: {
    fontSize: 14,
    color: C.ink,
    textAlign: "right",
    writingDirection: "rtl",
    fontFamily: Platform.OS === "android" ? "sans-serif" : undefined,
  },
  page: { padding: 22, paddingBottom: 30 },
  row: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  h1: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  h2: { fontSize: 17, fontWeight: "700" },
  caption: { fontSize: 12, color: C.muted, lineHeight: 21 },
  kicker: { fontSize: 11, color: C.muted, marginBottom: 6 },
  card: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  label: { fontSize: 12, fontWeight: "700" },
  input: {
    backgroundColor: C.white,
    borderColor: "#D9E0D7",
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: C.ink,
    textAlign: "right",
    writingDirection: "rtl",
    minHeight: 50,
  },
  button: {
    minHeight: 44,
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 17,
  },
  iconButton: { padding: 10, borderRadius: 12, backgroundColor: C.mint },
  emptyIcon: {
    width: 62,
    height: 62,
    backgroundColor: C.mint,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 16 },
  search: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    paddingHorizontal: 14,
    marginBottom: 18,
    gap: 10,
  },
});
