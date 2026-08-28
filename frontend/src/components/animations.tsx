import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// ---------------------------------------------------------------------------
// Falling flowers — a burst of petals drifting to Gopal's feet.
// ---------------------------------------------------------------------------
function Petal({
  index,
  trigger,
  width,
  fallTo,
  uri,
}: {
  index: number;
  trigger: number;
  width: number;
  fallTo: number;
  uri: string | null;
}) {
  const y = useSharedValue(-80);
  const opacity = useSharedValue(0);
  const rot = useSharedValue(0);

  const startX = 20 + ((index * 53) % Math.max(1, width - 60));
  const drift = ((index % 5) - 2) * 14;
  const size = 24 + (index % 4) * 6;
  const dur = 1600 + (index % 5) * 260;
  const delay = (index % 7) * 130;

  useEffect(() => {
    if (trigger === 0) return;
    y.value = -80;
    opacity.value = 0;
    rot.value = 0;
    opacity.value = withDelay(delay, withTiming(1, { duration: 220 }));
    y.value = withDelay(delay, withTiming(fallTo, { duration: dur, easing: Easing.in(Easing.quad) }));
    rot.value = withDelay(delay, withTiming((index % 2 ? 1 : -1) * 360, { duration: dur }));
    opacity.value = withDelay(delay + dur - 300, withTiming(0, { duration: 300 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: startX + drift * (y.value / Math.max(1, fallTo)) },
      { translateY: y.value },
      { rotate: `${rot.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.petal, { width: size, height: size }, style]} pointerEvents="none">
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="contain" />
      ) : (
        <MaterialCommunityIcons name="flower" size={size} color="#EF5DA8" />
      )}
    </Animated.View>
  );
}

export function FallingFlowers({
  trigger,
  width,
  height,
  uri,
}: {
  trigger: number;
  width: number;
  height: number;
  uri: string | null;
}) {
  const petals = Array.from({ length: 16 });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {petals.map((_, i) => (
        <Petal key={i} index={i} trigger={trigger} width={width} fallTo={height * 0.82} uri={uri} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Snan — water sheet flowing down over Gopal with sparkles.
// ---------------------------------------------------------------------------
export function WaterSnan({ trigger, onDone }: { trigger: number; onDone?: () => void }) {
  const y = useSharedValue(-1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (trigger === 0) return;
    y.value = -1;
    opacity.value = withSequence(withTiming(0.9, { duration: 300 }), withDelay(2400, withTiming(0, { duration: 500 })));
    y.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), 3, false);
    const id = setTimeout(() => onDone?.(), 3400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: `${y.value * 40}%` }],
  }));

  if (trigger === 0) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LinearGradient
        colors={["rgba(180,235,255,0)", "rgba(150,220,255,0.55)", "rgba(120,205,255,0.15)"]}
        style={StyleSheet.absoluteFill}
      />
      <Sparkles trigger={trigger} count={10} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Sparkles — twinkling light dots.
// ---------------------------------------------------------------------------
function Spark({ index, trigger }: { index: number; trigger: number }) {
  const scale = useSharedValue(0);
  const left = `${8 + ((index * 37) % 84)}%`;
  const top = `${12 + ((index * 53) % 70)}%`;
  useEffect(() => {
    if (trigger === 0) return;
    scale.value = withDelay(
      (index % 6) * 180,
      withRepeat(withSequence(withTiming(1, { duration: 350 }), withTiming(0, { duration: 350 })), 4, false),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: scale.value }));
  return (
    <Animated.View style={[styles.spark, { left, top } as any, style]} pointerEvents="none">
      <MaterialCommunityIcons name="star-four-points" size={16 + (index % 3) * 4} color="#FFF7D6" />
    </Animated.View>
  );
}

export function Sparkles({ trigger, count = 8 }: { trigger: number; count?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <Spark key={i} index={i} trigger={trigger} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Aarti — diya orbiting clockwise in front of Gopal.
// ---------------------------------------------------------------------------
export function OrbitingDiya({
  trigger,
  size,
  uri,
  onDone,
}: {
  trigger: number;
  size: number;
  uri: string | null;
  onDone?: () => void;
}) {
  const rot = useSharedValue(0);
  const opacity = useSharedValue(0);
  const radius = size * 0.3;

  useEffect(() => {
    if (trigger === 0) return;
    rot.value = 0;
    opacity.value = withSequence(withTiming(1, { duration: 300 }), withDelay(3600, withTiming(0, { duration: 500 })));
    rot.value = withRepeat(withTiming(360, { duration: 1600, easing: Easing.linear }), 3, false);
    const id = setTimeout(() => onDone?.(), 4400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  if (trigger === 0) return null;
  return (
    <Animated.View
      style={[styles.orbitRing, { width: radius * 2, height: radius * 2, borderRadius: radius }, ringStyle]}
      pointerEvents="none"
    >
      <View style={[styles.diyaHolder, { top: -22 }]}>
        {uri ? (
          <Image source={{ uri }} style={{ width: 52, height: 52 }} contentFit="contain" />
        ) : (
          <MaterialCommunityIcons name="candle" size={44} color="#FF7A00" />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  petal: { position: "absolute", top: 0, left: 0, alignItems: "center", justifyContent: "center" },
  spark: { position: "absolute" },
  orbitRing: {
    position: "absolute",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  diyaHolder: {
    position: "absolute",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF9500",
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
});
