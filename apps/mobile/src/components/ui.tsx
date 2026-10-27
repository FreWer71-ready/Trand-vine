import type { DrinkPhase } from "@trand-vine/core";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const colors = {
  wine: "#5B1A2E",
  wineLight: "#F4E9EC",
  text: "#1F1A1C",
  muted: "#6B6266",
  border: "#E2DADD",
  bg: "#FCFAFA",
  card: "#FFFFFF",
  success: "#2E6B3F",
  warning: "#9A5B00",
  danger: "#A12A2A",
};

export const PHASE_COLORS: Record<DrinkPhase, string> = {
  too_young: colors.muted,
  ready: colors.success,
  peak: colors.success,
  past_peak: colors.warning,
  over: colors.danger,
};

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: colors.muted }]}>{children}</Text>;
}

export function Card({ children, onPress, highlight }: { children: ReactNode; onPress?: () => void; highlight?: boolean }) {
  const style = [styles.card, highlight && { borderColor: colors.wine, backgroundColor: colors.wineLight }];
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [...style, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  ) : (
    <View style={style}>{children}</View>
  );
}

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
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: colors.wine } : { borderColor: colors.wine, borderWidth: 1 },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? "#fff" : colors.wine} />
      ) : (
        <Text style={[styles.buttonText, { color: primary ? "#fff" : colors.wine }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
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
  return (
    <View style={{ gap: 4 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.chips}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, selected && { backgroundColor: colors.wine, borderColor: colors.wine }]}
            >
              <Text style={{ color: selected ? "#fff" : colors.text }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Tags({ items }: { items: string[] }) {
  return (
    <View style={styles.chips}>
      {items.map((t) => (
        <View key={t} style={[styles.chip, { backgroundColor: colors.wineLight, borderColor: colors.wineLight }]}>
          <Text>{t}</Text>
        </View>
      ))}
    </View>
  );
}

export function Stars({ value, onChange }: { value: number | null; onChange?: (v: number) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} accessibilityLabel={`${n}`}>
          <Text style={{ fontSize: onChange ? 32 : 18, color: colors.wine }}>
            {value !== null && n <= Math.round(value) ? "★" : "☆"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <ActivityIndicator color={colors.wine} />
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <Text style={{ color: colors.danger }}>{children}</Text> : null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  heading: { fontSize: 17, fontWeight: "600", color: colors.text, marginTop: 8 },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 16, fontWeight: "600" },
  label: { fontSize: 13, color: colors.muted, fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.card,
  },
});
