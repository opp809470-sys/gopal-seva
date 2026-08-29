import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { COLORS } from "@/src/theme";
import { DRESS_SLOTS } from "@/src/gopalMeta";

export interface StagePositions {
  idol?: { width: number; height: number; offsetY: number };
  crown?: { top: number; width: number };
  tilak?: { top: number; width: number };
  garland?: { top: number; width: number };
  plate?: { top: number; width: number };
  bed?: { top: number; width: number };
}

export interface StageState {
  dress: string;
  tilak: boolean;
  crown: boolean;
  garland: boolean;
  flowers: number;
  bhog: string | null;
  sleeping: boolean;
}

interface Props {
  W: number;
  H: number;
  positions: StagePositions;
  state: StageState;
  assetUrl: (slot: string) => string | null;
  animateOrnaments?: boolean;
}

const P = (positions: StagePositions, k: keyof StagePositions, d: any) => (positions?.[k] as any) || d;

export function GopalStage({ W, H, positions, state, assetUrl, animateOrnaments = true }: Props) {
  return (
    <View style={{ width: W, height: H }}>
      {/* Bed (sleep) behind idol */}
      {state.sleeping && assetUrl("bed") && (
        <Animated.View
          entering={FadeIn}
          style={[
            styles.overlay,
            { top: `${P(positions, "bed", { top: 52, width: 92 }).top}%`, width: `${P(positions, "bed", { top: 52, width: 92 }).width}%` },
          ]}
        >
          <Image source={{ uri: assetUrl("bed")! }} style={styles.fillImg} contentFit="contain" />
        </Animated.View>
      )}

      {/* Idol layers (crossfade dress) */}
      {DRESS_SLOTS.map((slot) => (
        <IdolLayer key={slot} uri={assetUrl(slot)} active={state.dress === slot} />
      ))}

      {/* Tilak */}
      {state.tilak && <Tilak topPct={P(positions, "tilak", { top: 13, width: 5 }).top} />}

      {/* Crown */}
      {state.crown && (
        <DropLayer
          topPct={P(positions, "crown", { top: -1, width: 32 }).top}
          widthPct={P(positions, "crown", { top: -1, width: 32 }).width}
          animate={animateOrnaments}
        >
          {assetUrl("crown") ? (
            <Image source={{ uri: assetUrl("crown")! }} style={styles.fillImg} contentFit="contain" />
          ) : (
            <MaterialCommunityIcons name="crown" size={54} color={COLORS.gold} />
          )}
        </DropLayer>
      )}

      {/* Garland */}
      {state.garland && (
        <DropLayer
          topPct={P(positions, "garland", { top: 24, width: 29 }).top}
          widthPct={P(positions, "garland", { top: 24, width: 29 }).width}
          animate={animateOrnaments}
        >
          {assetUrl("garland") ? (
            <Image source={{ uri: assetUrl("garland")! }} style={styles.fillImg} contentFit="contain" />
          ) : (
            <MaterialCommunityIcons name="flower-poppy" size={70} color={COLORS.saffron} />
          )}
        </DropLayer>
      )}

      {/* Flower pile at feet */}
      {state.flowers > 0 && <FlowerPile count={state.flowers} uri={assetUrl("flower")} />}

      {/* Bhog plate */}
      {state.bhog && (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[
            styles.overlay,
            {
              top: `${P(positions, "plate", { top: 82, width: 38 }).top}%`,
              width: `${P(positions, "plate", { top: 82, width: 38 }).width}%`,
              aspectRatio: 1.4,
            },
          ]}
        >
          {assetUrl("plate") && (
            <Image source={{ uri: assetUrl("plate")! }} style={StyleSheet.absoluteFill} contentFit="contain" />
          )}
          {assetUrl(state.bhog) && (
            <Image source={{ uri: assetUrl(state.bhog)! }} style={styles.bhogFood} contentFit="contain" />
          )}
        </Animated.View>
      )}
    </View>
  );
}

function IdolLayer({ uri, active }: { uri: string | null; active: boolean }) {
  const opacity = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0, { duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!uri) {
    return active ? (
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        <MaterialCommunityIcons name="account-child-circle" size={120} color={COLORS.saffronDark} />
      </View>
    ) : null;
  }
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
    </Animated.View>
  );
}

function DropLayer({
  topPct,
  widthPct,
  animate,
  children,
}: {
  topPct: number;
  widthPct: number;
  animate: boolean;
  children: React.ReactNode;
}) {
  const ty = useSharedValue(animate ? -70 : 0);
  const opacity = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) {
      ty.value = withSequence(
        withTiming(6, { duration: 420, easing: Easing.out(Easing.back(1.4)) }),
        withTiming(0, { duration: 160 }),
      );
      opacity.value = withTiming(1, { duration: 300 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: ty.value }] }));
  return (
    <Animated.View
      style={[styles.overlay, { top: `${topPct}%`, width: `${widthPct}%`, aspectRatio: 1 }, style]}
      pointerEvents="none"
    >
      {children}
    </Animated.View>
  );
}

function Tilak({ topPct }: { topPct: number }) {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withSequence(withTiming(1.3, { duration: 260 }), withTiming(1, { duration: 160 }));
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.tilakWrap, { top: `${topPct}%` }, style]} pointerEvents="none">
      <View style={styles.tilakU} />
      <View style={styles.tilakCenter} />
    </Animated.View>
  );
}

function FlowerPile({ count, uri }: { count: number; uri: string | null }) {
  const items = Array.from({ length: Math.min(count, 18) });
  return (
    <View style={styles.pileWrap} pointerEvents="none">
      {items.map((_, i) => {
        const left = 10 + ((i * 41) % 80);
        const bottom = (i % 3) * 8;
        const size = 16 + (i % 3) * 5;
        return (
          <Animated.View
            key={i}
            entering={FadeIn.delay(i * 25)}
            style={{ position: "absolute", left: `${left}%`, bottom, width: size, height: size }}
          >
            {uri ? (
              <Image source={{ uri }} style={{ width: size, height: size }} contentFit="contain" />
            ) : (
              <MaterialCommunityIcons name="flower" size={size} color="#EF5DA8" />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  overlay: { position: "absolute", alignSelf: "center", alignItems: "center", justifyContent: "center" },
  fillImg: { width: "100%", height: "100%" },
  bhogFood: { position: "absolute", width: "55%", height: "70%", alignSelf: "center", top: "6%" },
  tilakWrap: { position: "absolute", alignSelf: "center", width: 16, height: 22, alignItems: "center" },
  tilakU: {
    width: 15,
    height: 20,
    borderColor: "#F3D9A0",
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  tilakCenter: { position: "absolute", top: 1, width: 3.5, height: 17, borderRadius: 2, backgroundColor: "#C62828" },
  pileWrap: { position: "absolute", bottom: "2%", left: 0, right: 0, height: 40 },
});
