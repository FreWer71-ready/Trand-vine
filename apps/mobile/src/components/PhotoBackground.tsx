// Fotolik bakgrund som rör sig sakta (panorering och zoom), som i en väderapp.
// Rörelsen gör skärmen levande och skonar en skärm som alltid är på mot inbränning.
// Bilderna skapas av scripts/make-backgrounds.py.

import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from "react-native";

const SCENES = {
  cellar: require("../../assets/backgrounds/cellar.jpg"),
  vineyard: require("../../assets/backgrounds/vineyard.jpg"),
  glass: require("../../assets/backgrounds/glass.jpg"),
  oak: require("../../assets/backgrounds/oak.jpg"),
};
export type Scene = keyof typeof SCENES;

/** En halv cykel (ut eller tillbaka). Långsamt: rörelsen ska anas, inte synas. */
const HALF_CYCLE_MS = 50_000;

export function PhotoBackground({ scene = "cellar" }: { scene?: Scene }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    const leg = (toValue: number) =>
      Animated.timing(t, { toValue, duration: HALF_CYCLE_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web" });
    // Den som har stängt av rörelse i systemet får en stillbild.
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce || cancelled) return;
        loop = Animated.loop(Animated.sequence([leg(1), leg(0)]));
        loop.start();
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [t]);

  const range = (from: number, to: number) => t.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <Animated.Image
        source={SCENES[scene]}
        resizeMode="cover"
        style={{ width: "100%", height: "100%", transform: [{ scale: range(1.08, 1.2) }, { translateX: range(-12, 12) }, { translateY: range(8, -8) }] }}
      />
      {/* Slöja så att text och kort går att läsa ovanpå bilden. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.28)" }]} />
    </View>
  );
}
