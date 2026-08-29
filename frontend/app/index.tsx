import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import dayjs from "dayjs";

import { useApp } from "@/src/AppContext";
import { audio } from "@/src/audio";
import { storage } from "@/src/utils/storage";
import { COLORS, RADIUS, SHADOW, SPACING } from "@/src/theme";
import { BHOG_SLOTS, DRESS_SLOTS, ITEMS, SEQUENCE, type ItemId } from "@/src/gopalMeta";
import { FallingFlowers, OrbitingDiya, Sparkles, WaterSnan } from "@/src/components/animations";
import { GopalStage } from "@/src/components/GopalStage";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

interface SevaState {
  dress: string;
  tilak: boolean;
  crown: boolean;
  garland: boolean;
  flowers: number;
  bhog: string | null;
  sleeping: boolean;
  done: ItemId[];
}

const freshState = (): SevaState => ({
  dress: "idol",
  tilak: false,
  crown: false,
  garland: false,
  flowers: 0,
  bhog: null,
  sleeping: false,
  done: [],
});

export default function GopalSeva() {
  const { config, loading, t, lang, setLang, soundOn, musicOn, toggleSound, toggleMusic, assetUrl, soundUrl } =
    useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: SW, height: SH } = useWindowDimensions();

  const today = dayjs().format("YYYY-MM-DD");
  const [state, setState] = useState<SevaState>(freshState());
  const [ready, setReady] = useState(false);

  const [dressSheet, setDressSheet] = useState(false);
  const [bhogSheet, setBhogSheet] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  // transient animation triggers
  const [flowerTrig, setFlowerTrig] = useState(0);
  const [waterTrig, setWaterTrig] = useState(0);
  const [aartiTrig, setAartiTrig] = useState(0);
  const bellRot = useSharedValue(0);

  // ---- persistence ----
  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<any>(`gopal_seva_${today}`, null);
      if (saved && saved.dress) setState(saved);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(
    (next: SevaState) => {
      storage.setItem(`gopal_seva_${today}`, next as any);
      const completed = SEQUENCE.every((s) => next.done.includes(s));
      fetch(`${BACKEND}/api/gopal/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, steps: next.done, completed }),
      }).catch(() => {});
    },
    [today],
  );

  const update = useCallback(
    (patch: Partial<SevaState>, doneStep?: ItemId) => {
      setState((prev) => {
        const done = doneStep && !prev.done.includes(doneStep) ? [...prev.done, doneStep] : prev.done;
        const next = { ...prev, ...patch, done };
        persist(next);
        if (doneStep && SEQUENCE.every((s) => next.done.includes(s))) {
          setTimeout(() => setShowComplete(true), 700);
        }
        return next;
      });
    },
    [persist],
  );

  // background music for sleep
  useEffect(() => {
    if (state.sleeping && musicOn) audio.startMusic(soundUrl("lullaby") || soundUrl("bg_music"), 0.4);
    else audio.stopMusic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sleeping, musicOn]);

  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  // ---- actions ----
  const handleItem = (id: ItemId) => {
    tap();
    switch (id) {
      case "snan":
        setWaterTrig((n) => n + 1);
        audio.playEffect(soundUrl("water"), 0.7);
        update({}, "snan");
        break;
      case "chandan":
        update({ tilak: true }, "chandan");
        break;
      case "dress":
        setDressSheet(true);
        break;
      case "crown":
        update({ crown: true }, "crown");
        break;
      case "garland":
        update({ garland: true }, "garland");
        break;
      case "flower":
        setFlowerTrig((n) => n + 1);
        update({ flowers: Math.min(state.flowers + 6, 24) }, "flower");
        break;
      case "bhog":
        setBhogSheet(true);
        break;
      case "aarti":
        setAartiTrig((n) => n + 1);
        audio.playEffect(soundUrl("aarti") || soundUrl("bell"), 0.8);
        update({}, "aarti");
        break;
      case "bell":
        bellRot.value = withSequence(
          withTiming(-18, { duration: 120 }),
          withRepeat(withSequence(withTiming(18, { duration: 220 }), withTiming(-18, { duration: 220 })), 4, true),
          withTiming(0, { duration: 160 }),
        );
        audio.playEffect(soundUrl("bell"), 1);
        break;
      case "sleep":
        update({ sleeping: !state.sleeping }, "sleep");
        break;
    }
  };

  const chooseDress = (slot: string) => {
    tap();
    setDressSheet(false);
    update({ dress: slot }, "dress");
  };
  const chooseBhog = (slot: string) => {
    tap();
    setBhogSheet(false);
    update({ bhog: slot }, "bhog");
  };

  const restart = () => {
    tap();
    setShowComplete(false);
    const f = freshState();
    setState(f);
    persist(f);
    setFlowerTrig(0);
    setWaterTrig(0);
    setAartiTrig(0);
  };

  // next step hint
  const nextStep = SEQUENCE.find((s) => !state.done.includes(s));

  // ---- stage geometry ----
  const pos = config?.positions || {};
  const idolPos = pos.idol || { width: 67, height: 50, offsetY: 0 };
  const stageW = SW * (idolPos.width / 100);
  const stageH = SH * (idolPos.height / 100);

  const bellStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${bellRot.value}deg` }] }));

  const bgUri = assetUrl("background");

  if (loading || !ready) {
    return (
      <View style={[styles.root, styles.center]}>
        <MaterialCommunityIcons name="flower-tulip" size={48} color={COLORS.saffron} />
        <Text style={styles.loadingText}>{t("loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Background */}
      {bgUri ? (
        <Image source={{ uri: bgUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
      ) : (
        <LinearGradient colors={["#FFE7B8", "#F6B24B", "#E8821E"]} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={["rgba(255,240,210,0.35)", "rgba(255,255,255,0)", "rgba(94,25,19,0.25)"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Night dim when sleeping */}
      {state.sleeping && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.nightDim} pointerEvents="none">
          <MaterialCommunityIcons name="weather-night" size={40} color="#FFE9A8" style={styles.moon} />
        </Animated.View>
      )}

      {/* Hanging temple bell */}
      <Animated.View style={[styles.hangBell, { top: insets.top + 74 }, bellStyle]} pointerEvents="none">
        {assetUrl("bell") ? (
          <Image source={{ uri: assetUrl("bell")! }} style={{ width: 46, height: 62 }} contentFit="contain" />
        ) : (
          <MaterialCommunityIcons name="bell" size={40} color={COLORS.gold} />
        )}
      </Animated.View>

      {/* ---------- STAGE ---------- */}
      <View style={[styles.stageWrap, { transform: [{ translateY: (idolPos.offsetY / 100) * SH }] }]} pointerEvents="none">
        <GopalStage W={stageW} H={stageH} positions={pos} state={state} assetUrl={assetUrl} animateOrnaments />

        {/* Transient effects centered over stage */}
        <View style={[styles.effectLayer, { width: stageW, height: stageH }]}>
          <FallingFlowers trigger={flowerTrig} width={stageW} height={stageH} uri={assetUrl("flower")} />
          <WaterSnan trigger={waterTrig} />
          <View style={styles.orbitCenter}>
            <OrbitingDiya trigger={aartiTrig} size={stageH} uri={assetUrl("diya")} />
          </View>
        </View>
      </View>

      {/* ---------- HEADER (sticky) ---------- */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title} testID="app-title">
              {t("app_title")}
            </Text>
            <Text style={styles.subtitle}>{t("subtitle")}</Text>
          </View>
          <View style={styles.controls}>
            <CtrlBtn icon={soundOn ? "volume-high" : "volume-off"} active={soundOn} onPress={toggleSound} testID="toggle-sound" />
            <CtrlBtn icon={musicOn ? "music" : "music-off"} active={musicOn} onPress={toggleMusic} testID="toggle-music" />
            <CtrlBtn
              icon="cog"
              active={false}
              onPress={() => {
                tap();
                router.push("/admin");
              }}
              testID="open-admin"
            />
          </View>
        </View>

        {/* language toggle */}
        <View style={styles.langRow}>
          {(["bn", "hi", "en"] as const).map((l) => (
            <Pressable
              key={l}
              testID={`lang-${l}`}
              onPress={() => {
                tap();
                setLang(l);
              }}
              style={[styles.langChip, lang === l && styles.langChipActive]}
            >
              <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                {l === "bn" ? "বাংলা" : l === "hi" ? "हिन्दी" : "EN"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* progress */}
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>{t("progress")}</Text>
          <View style={styles.progressDots}>
            {SEQUENCE.map((s, i) => {
              const done = state.done.includes(s);
              const isNext = s === nextStep;
              return (
                <View key={s} style={styles.progressItem}>
                  <View
                    testID={`progress-${s}`}
                    style={[styles.dot, done && styles.dotDone, isNext && !done && styles.dotNext]}
                  >
                    {done ? (
                      <MaterialCommunityIcons name="check" size={13} color="#fff" />
                    ) : (
                      <Text style={styles.dotNum}>{i + 1}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* ---------- TRAY ---------- */}
      <View style={[styles.tray, { paddingBottom: insets.bottom + SPACING.md }]}>
        <Text style={styles.trayHint}>{t("tap_hint")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.trayContent}
        >
          {ITEMS.map((item) => {
            const done = state.done.includes(item.id);
            const isNext = item.id === nextStep;
            const thumb =
              item.id === "dress" ? assetUrl(state.dress) :
              item.id === "bhog" ? assetUrl("laddu") :
              assetUrl(item.id);
            return (
              <Pressable
                key={item.id}
                testID={`item-${item.id}`}
                onPress={() => handleItem(item.id)}
                style={styles.trayItem}
              >
                <View style={[styles.trayIcon, { borderColor: item.color }, isNext && styles.trayIconNext, done && styles.trayIconDone]}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.trayThumb} contentFit="contain" />
                  ) : (
                    <MaterialCommunityIcons name={item.icon as any} size={26} color={item.color} />
                  )}
                  {done && (
                    <View style={styles.trayCheck}>
                      <MaterialCommunityIcons name="check" size={11} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={styles.trayLabel} numberOfLines={1}>
                  {t(item.id)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ---------- DRESS SHEET ---------- */}
      <ChoiceSheet
        visible={dressSheet}
        title={t("choose_dress")}
        onClose={() => setDressSheet(false)}
        closeLabel={t("close")}
        options={DRESS_SLOTS.map((s) => ({ slot: s, label: t(s), uri: assetUrl(s), selected: state.dress === s }))}
        onSelect={chooseDress}
        testPrefix="dress"
      />

      {/* ---------- BHOG SHEET ---------- */}
      <ChoiceSheet
        visible={bhogSheet}
        title={t("choose_bhog")}
        onClose={() => setBhogSheet(false)}
        closeLabel={t("close")}
        options={BHOG_SLOTS.map((s) => ({ slot: s, label: t(s), uri: assetUrl(s), selected: state.bhog === s }))}
        onSelect={chooseBhog}
        testPrefix="bhog"
      />

      {/* ---------- COMPLETE ---------- */}
      <Modal visible={showComplete} transparent animationType="fade">
        <View style={styles.completeBackdrop}>
          <Sparkles trigger={showComplete ? 1 : 0} count={14} />
          <Animated.View entering={FadeIn} style={styles.completeCard} testID="complete-card">
            <MaterialCommunityIcons name="flower-tulip" size={54} color={COLORS.saffron} />
            <Text style={styles.completeTitle}>আজকের গোপাল সেবা সম্পূর্ণ হয়েছে</Text>
            <Text style={styles.completeSub}>Today's Gopal Seva is complete.</Text>
            <Pressable testID="restart-btn" onPress={restart} style={styles.restartBtn}>
              <MaterialCommunityIcons name="restart" size={18} color="#fff" />
              <Text style={styles.restartText}>{t("restart")}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub components
// ---------------------------------------------------------------------------
function CtrlBtn({ icon, active, onPress, testID }: { icon: string; active: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.ctrlBtn, active && styles.ctrlBtnActive]}>
      <MaterialCommunityIcons name={icon as any} size={20} color={active ? "#fff" : COLORS.maroon} />
    </Pressable>
  );
}

interface Opt {
  slot: string;
  label: string;
  uri: string | null;
  selected: boolean;
}
function ChoiceSheet({
  visible,
  title,
  options,
  onSelect,
  onClose,
  closeLabel,
  testPrefix,
}: {
  visible: boolean;
  title: string;
  options: Opt[];
  onSelect: (slot: string) => void;
  onClose: () => void;
  closeLabel: string;
  testPrefix: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{title}</Text>
        <View style={styles.sheetOptions}>
          {options.map((o) => (
            <Pressable
              key={o.slot}
              testID={`${testPrefix}-option-${o.slot}`}
              onPress={() => onSelect(o.slot)}
              style={[styles.optCard, o.selected && styles.optCardActive]}
            >
              <View style={styles.optThumb}>
                {o.uri ? (
                  <Image source={{ uri: o.uri }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                ) : (
                  <MaterialCommunityIcons name="image-outline" size={30} color={COLORS.saffronDark} />
                )}
              </View>
              <Text style={styles.optLabel}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable testID={`${testPrefix}-close`} onPress={onClose} style={styles.sheetClose}>
          <Text style={styles.sheetCloseText}>{closeLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: SPACING.md, color: COLORS.maroon, fontSize: 16, fontWeight: "600" },

  nightDim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,10,30,0.62)" },
  moon: { position: "absolute", right: 28, top: 120 },

  hangBell: { position: "absolute", right: 18, alignItems: "center" },

  // stage
  stageWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  effectLayer: { position: "absolute", alignItems: "center", justifyContent: "center" },
  orbitCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  overlay: { position: "absolute", alignSelf: "center", left: undefined, alignItems: "center", justifyContent: "center" },
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

  // header
  header: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: SPACING.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.maroon, textShadowColor: "rgba(255,255,255,0.6)", textShadowRadius: 6 },
  subtitle: { fontSize: 13, fontWeight: "600", color: COLORS.saffronDark, marginTop: 2 },
  controls: { flexDirection: "row", gap: SPACING.xs },
  ctrlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.soft,
  },
  ctrlBtnActive: { backgroundColor: COLORS.saffron },

  langRow: { flexDirection: "row", gap: SPACING.xs, marginTop: SPACING.sm },
  langChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: "rgba(255,255,255,0.85)" },
  langChipActive: { backgroundColor: COLORS.maroon },
  langText: { fontSize: 13, fontWeight: "700", color: COLORS.maroon },
  langTextActive: { color: "#fff" },

  progressCard: {
    marginTop: SPACING.sm,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    ...SHADOW.soft,
  },
  progressLabel: { fontSize: 11, fontWeight: "700", color: COLORS.saffronDark, marginBottom: 6, marginLeft: 2 },
  progressDots: { flexDirection: "row", justifyContent: "space-between" },
  progressItem: { alignItems: "center" },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#EAD9BC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  dotDone: { backgroundColor: COLORS.green },
  dotNext: { borderColor: COLORS.saffron, backgroundColor: COLORS.goldSoft },
  dotNum: { fontSize: 12, fontWeight: "700", color: COLORS.maroon },

  // tray
  tray: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(255,246,230,0.94)", borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, paddingTop: SPACING.sm, ...SHADOW.card },
  trayHint: { textAlign: "center", fontSize: 12, fontWeight: "600", color: COLORS.saffronDark, marginBottom: SPACING.xs },
  trayContent: { paddingHorizontal: SPACING.md, gap: SPACING.sm, alignItems: "center" },
  trayItem: { alignItems: "center", width: 66, flexShrink: 0 },
  trayIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    ...SHADOW.soft,
  },
  trayIconNext: { transform: [{ scale: 1.06 }], borderColor: COLORS.saffron },
  trayIconDone: { opacity: 0.85 },
  trayThumb: { width: 40, height: 40 },
  trayCheck: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  trayLabel: { marginTop: 4, fontSize: 11.5, fontWeight: "700", color: COLORS.maroon, textAlign: "center" },

  // sheets
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: COLORS.cream, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACING.lg },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.creamDim, marginBottom: SPACING.md },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: COLORS.maroon, marginBottom: SPACING.md },
  sheetOptions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md },
  optCard: { width: "47%", backgroundColor: "#fff", borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: "center", borderWidth: 2, borderColor: "transparent", ...SHADOW.soft },
  optCardActive: { borderColor: COLORS.saffron, backgroundColor: COLORS.goldSoft },
  optThumb: { width: "100%", height: 110, alignItems: "center", justifyContent: "center" },
  optLabel: { marginTop: SPACING.xs, fontSize: 14, fontWeight: "700", color: COLORS.maroon },
  sheetClose: { marginTop: SPACING.lg, alignSelf: "center", paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill, backgroundColor: COLORS.maroon },
  sheetCloseText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // complete
  completeBackdrop: { flex: 1, backgroundColor: "rgba(20,8,4,0.75)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  completeCard: { backgroundColor: COLORS.cream, borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: "center", width: "100%", maxWidth: 360 },
  completeTitle: { fontSize: 20, fontWeight: "800", color: COLORS.maroon, textAlign: "center", marginTop: SPACING.md },
  completeSub: { fontSize: 15, fontWeight: "600", color: COLORS.saffronDark, textAlign: "center", marginTop: SPACING.xs },
  restartBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.xs, marginTop: SPACING.lg, backgroundColor: COLORS.saffron, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill },
  restartText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
