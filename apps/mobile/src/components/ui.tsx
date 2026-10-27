// Grundkomponenter. All färg, typografi och form kommer från designsystemets
// tema (useTheme), så att appen kan byta mellan Tour och Party.

import type { DrinkPhase } from "@trand-vine/core";
import type { Theme } from "@trand-vine/design";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../lib/theme.tsx";

export function phaseColor(theme: Theme, phase: DrinkPhase): string {
  const c = theme.colors;
  return { too_young: c.textMuted, ready: c.success, peak: c.success, past_peak: c.warning, over: c.danger }[phase];
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const theme = useTheme();
  const content = { padding: theme.space.lg, gap: theme.space.md };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["left", "right", "bottom"]}>
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[content, { flexGrow: 1 }]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[content, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type Variant = "display" | "title" | "heading" | "cardTitle" | "body" | "strong" | "muted" | "label" | "data";

/** Text i en av designsystemets roller. */
export function T({
  variant = "body",
  color,
  style,
  children,
  numberOfLines,
}: {
  variant?: Variant;
  color?: string;
  style?: TextStyle;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  const { fonts, type, colors } = theme;
  const styles: Record<Variant, TextStyle> = {
    display: { fontFamily: fonts.display.native, fontSize: type.display, lineHeight: type.display * 1.15 },
    title: { fontFamily: fonts.display.native, fontSize: type.title, lineHeight: type.title * 1.25, color: colors.navActive },
    heading: { fontFamily: fonts.heading.native, fontSize: type.heading, lineHeight: type.heading * 1.25, marginTop: theme.space.lg, paddingBottom: theme.space.xs, borderBottomWidth: 1, borderBottomColor: colors.accent },
    cardTitle: { fontFamily: fonts.heading.native, fontSize: type.heading, lineHeight: type.heading * 1.25 },
    body: { fontFamily: fonts.body.native, fontSize: type.body, lineHeight: type.body * 1.5 },
    strong: { fontFamily: fonts.bodyStrong.native, fontSize: type.body, lineHeight: type.body * 1.5 },
    muted: { fontFamily: fonts.body.native, fontSize: type.small, lineHeight: type.small * 1.45, color: colors.textMuted },
    label: {
      fontFamily: fonts.label.native,
      fontSize: type.label,
      color: colors.accent,
      letterSpacing: theme.label.letterSpacing,
      textTransform: theme.label.uppercase ? "uppercase" : "none",
    },
    data: { fontFamily: fonts.data.native, fontSize: type.small, fontVariant: ["tabular-nums"] },
  };
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: colors.text }, styles[variant], color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

export const Title = ({ children }: { children: ReactNode }) => <T variant="title">{children}</T>;
export const Heading = ({ children }: { children: ReactNode }) => <T variant="heading">{children}</T>;
export const Body = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <T variant={muted ? "muted" : "body"}>{children}</T>
);

export function Card({ children, onPress, highlight }: { children: ReactNode; onPress?: () => void; highlight?: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  const style = {
    backgroundColor: highlight ? c.highlight : c.surface,
    borderRadius: theme.radius.card,
    borderWidth: highlight ? 2 : 1,
    borderColor: highlight ? c.accent : c.border,
    padding: theme.space.lg,
    gap: theme.space.sm,
  };
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.75 }]}>
      {children}
    </Pressable>
  ) : (
    <View style={style}>{children}</View>
  );
}

/**
 * Knapp. Party: färgad kant under knappen som trycks ner (3D-tryck).
 * Tour: platt knapp med ram och etiketter i versaler.
 */
export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const b = theme.button;
  const [pressed, setPressed] = useState(false);
  const primary = variant === "primary";
  const bg = primary ? c.primary : c.secondary;
  const fg = primary ? c.onPrimary : c.onSecondary;
  const edge = primary ? c.primaryEdge : c.secondaryEdge;
  const inactive = disabled || loading;
  const press = b.style === "press";
  const down = press && pressed && !inactive;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={inactive}
      style={{
        minHeight: 52,
        borderRadius: theme.radius.button,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: theme.space.xl,
        backgroundColor: bg,
        opacity: inactive ? 0.55 : !press && pressed ? 0.8 : 1,
        ...(press
          ? { borderBottomWidth: down ? 0 : b.edgeHeight, borderBottomColor: edge, marginTop: down ? b.edgeHeight : 0 }
          : { borderWidth: 1, borderColor: edge }),
      }}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text
          style={{
            color: fg,
            fontFamily: theme.fonts[b.font].native,
            fontSize: b.uppercase ? 15 : 17,
            letterSpacing: b.letterSpacing,
            textTransform: b.uppercase ? "uppercase" : "none",
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={{ gap: theme.space.xs }}>
      <T variant="label">{label}</T>
      <TextInput
        placeholderTextColor={c.textMuted}
        style={{
          borderWidth: 1.5,
          borderColor: c.border,
          borderRadius: theme.radius.field,
          padding: theme.space.md + 2,
          fontSize: theme.type.body,
          fontFamily: theme.fonts.body.native,
          backgroundColor: c.surface,
          color: c.text,
        }}
        {...props}
      />
    </View>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (v: T) => void;
  label?: string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={{ gap: theme.space.xs }}>
      {label && <TLabel>{label}</TLabel>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm }}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={{
                borderWidth: 1,
                borderColor: selected ? c.primary : c.border,
                borderRadius: theme.radius.chip,
                paddingHorizontal: theme.space.md,
                paddingVertical: 9,
                backgroundColor: selected ? c.primary : c.surface,
              }}
            >
              <Text style={{ color: selected ? c.onPrimary : c.text, fontFamily: theme.fonts.body.native, fontSize: theme.type.small + 1 }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Antal med minus/plus, t.ex. hur många flaskor. */
export function Stepper({
  label,
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const step = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  const btn = (d: number, sign: string, name: string) => {
    const disabled = d < 0 ? value <= min : value >= max;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => step(d)}
        style={{
          width: 48,
          height: 48,
          borderRadius: theme.radius.chip,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <Text style={{ color: c.text, fontSize: 24, fontFamily: theme.fonts.body.native }}>{sign}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: theme.space.xs }}>
      <TLabel>{label}</TLabel>
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.space.md }}>
        {btn(-1, "−", `${label} −1`)}
        <T variant="title">{String(value)}</T>
        {btn(1, "+", `${label} +1`)}
      </View>
    </View>
  );
}

const TLabel = ({ children }: { children: ReactNode }) => <T variant="label">{children}</T>;

export function Tags({ items }: { items: string[] }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm }}>
      {items.map((t) => (
        <View
          key={t}
          style={{ backgroundColor: theme.colors.tag, borderRadius: theme.radius.chip, paddingHorizontal: theme.space.md, paddingVertical: 6 }}
        >
          <Text style={{ color: theme.colors.onTag, fontFamily: theme.fonts.body.native, fontSize: theme.type.small + 1 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

export function Stars({ value, onChange }: { value: number | null; onChange?: (v: number) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} accessibilityLabel={`${n}`}>
          <Text style={{ fontSize: onChange ? 32 : 18, color: theme.colors.accent }}>
            {value !== null && n <= Math.round(value) ? "★" : "☆"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: theme.colors.background }}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return children ? <T color={theme.colors.danger}>{children}</T> : null;
}
