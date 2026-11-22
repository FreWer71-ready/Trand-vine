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
import { useLocale } from "../lib/i18n.tsx";
import { READABLE_MAX, useLayout } from "../lib/layout.ts";
import { useTheme } from "../lib/theme.tsx";

export function phaseColor(theme: Theme, phase: DrinkPhase): string {
  const c = theme.colors;
  return { too_young: c.textMuted, ready: c.success, peak: c.success, past_peak: c.warning, over: c.danger }[phase];
}

/**
 * Skärmens innehåll. wide = listor som får använda hela ramens bredd (kort i
 * kolumner); annars hålls innehållet till läsbar bredd på stora skärmar.
 */
export function Screen({ children, scroll = true, wide = false }: { children: ReactNode; scroll?: boolean; wide?: boolean }) {
  const theme = useTheme();
  const { size } = useLayout();
  const content = {
    padding: size === "phone" ? theme.space.lg : theme.space.xl,
    gap: theme.space.md,
    width: "100%" as const,
    maxWidth: wide ? undefined : READABLE_MAX,
    alignSelf: "center" as const,
  };
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

/**
 * Kort i kolumner: en kolumn på telefon, två på surfplatta, tre på dator.
 * Varje barn blir en cell; cellerna i en rad får samma bredd.
 */
export function Grid({ children }: { children: ReactNode[] }) {
  const theme = useTheme();
  const { columns } = useLayout();
  if (columns === 1) return <>{children}</>;
  const gap = theme.space.md;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -gap / 2, rowGap: gap }}>
      {children.map((child, i) => (
        <View key={i} style={{ width: `${100 / columns}%`, paddingHorizontal: gap / 2 }}>
          {child}
        </View>
      ))}
    </View>
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
    title: { fontFamily: fonts.display.native, fontSize: type.title, lineHeight: type.title * 1.2 },
    heading: { fontFamily: fonts.heading.native, fontSize: type.heading, lineHeight: type.heading * 1.3, marginTop: theme.space.lg, paddingBottom: theme.space.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
    cardTitle: { fontFamily: fonts.heading.native, fontSize: type.body + 1, lineHeight: (type.body + 1) * 1.3 },
    body: { fontFamily: fonts.body.native, fontSize: type.body, lineHeight: type.body * 1.4 },
    strong: { fontFamily: fonts.bodyStrong.native, fontSize: type.body, lineHeight: type.body * 1.4 },
    muted: { fontFamily: fonts.body.native, fontSize: type.small, lineHeight: type.small * 1.4, color: colors.textMuted },
    label: {
      fontFamily: fonts.label.native,
      fontSize: type.label,
      lineHeight: type.label * 1.3,
      color: colors.textMuted,
      letterSpacing: theme.label.letterSpacing,
      textTransform: theme.label.uppercase ? "uppercase" : "none",
    },
    data: { fontFamily: fonts.data.native, fontSize: type.small, lineHeight: type.small * 1.4, fontVariant: ["tabular-nums"] },
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

/** Betyg 1–5 med en decimal, visat som 3,5. */
export function formatRating(value: number, locale: string): string {
  return value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Avrundar till en decimal inom 1–5. */
export function clampRating(v: number): number {
  return Math.min(5, Math.max(1, Math.round(v * 10) / 10));
}

/** En stjärna: hel, halv eller tom. Halvan är en fylld stjärna klippt till vänstra halvan. */
function Star({ fill, size, color }: { fill: 0 | 0.5 | 1; size: number; color: string }) {
  // Glyfen centreras i en ruta med fast bredd, så att halva rutan är exakt halva stjärnan.
  const box = { width: size, height: size * 1.25 } as const;
  const glyph = { fontSize: size, color, lineHeight: size * 1.25, width: size, textAlign: "center" } as const;
  return (
    <View style={box}>
      <Text style={glyph}>{fill === 1 ? "★" : "☆"}</Text>
      {fill === 0.5 && (
        <View style={{ position: "absolute", left: 0, top: 0, height: box.height, width: size / 2, overflow: "hidden" }}>
          <Text style={glyph}>★</Text>
        </View>
      )}
    </View>
  );
}

/** Hur stjärna n ska fyllas för ett betyg, avrundat till närmaste halva. */
export function starFill(value: number | null, n: number): 0 | 0.5 | 1 {
  if (value === null) return 0;
  const half = Math.round(value * 2) / 2;
  return n <= half ? 1 : n - 0.5 === half ? 0.5 : 0;
}

/** Stjärnor med halva stjärnor och betyget som siffra bredvid (t.ex. ★★★½ 3,7). */
export function Stars({ value, showValue = true, size = 18 }: { value: number | null; showValue?: boolean; size?: number }) {
  const theme = useTheme();
  const locale = useLocale();
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
      accessibilityLabel={value !== null ? `${formatRating(value, locale)} / 5` : undefined}
    >
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} fill={starFill(value, n)} size={size} color={theme.colors.accent} />)}
      {showValue && value !== null && (
        <T variant="strong" style={{ marginLeft: theme.space.sm }}>{formatRating(value, locale)}</T>
      )}
    </View>
  );
}

/**
 * Sätt betyg: tryck på vänstra halvan av en stjärna för en halv, högra för hel.
 * Finjustera med − och + i steg om 0,1.
 */
export function RatingInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const theme = useTheme();
  const locale = useLocale();
  const c = theme.colors;
  const size = 34;
  const stepBtn = (d: number, sign: string) => {
    const disabled = value === null || (d < 0 ? value <= 1 : value >= 5);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${sign}0,1`}
        disabled={disabled}
        onPress={() => value !== null && onChange(clampRating(value + d))}
        style={{
          width: 40, height: 40, borderRadius: theme.radius.chip, borderWidth: 1, borderColor: c.border,
          backgroundColor: c.surface, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1,
        }}
      >
        <Text style={{ color: c.text, fontSize: 20, fontFamily: theme.fonts.body.native }}>{sign}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: theme.space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <View key={n}>
            <Star fill={starFill(value, n)} size={size} color={c.accent} />
            <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, flexDirection: "row" }}>
              <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${n - 0.5}`} onPress={() => onChange(n - 0.5 < 1 ? 1 : n - 0.5)} />
              <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${n}`} onPress={() => onChange(n)} />
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.space.md }}>
        {stepBtn(-0.1, "−")}
        <T variant="title" style={{ minWidth: 48, textAlign: "center" }}>{value !== null ? formatRating(value, locale) : "–"}</T>
        {stepBtn(0.1, "+")}
        {value !== null && (
          <Pressable accessibilityRole="button" onPress={() => onChange(null)} style={{ padding: 8 }}>
            <Text style={{ color: c.textMuted, fontFamily: theme.fonts.body.native }}>✕</Text>
          </Pressable>
        )}
      </View>
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
