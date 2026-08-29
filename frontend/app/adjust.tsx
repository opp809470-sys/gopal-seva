import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { useApp } from "@/src/AppContext";
import { COLORS, RADIUS, SHADOW, SPACING } from "@/src/theme";
import { GopalStage, type StagePositions } from "@/src/components/GopalStage";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const DEFAULTS: StagePositions = {
  idol: { width: 67, height: 50, offsetY: 0 },
  crown: { top: -1, width: 32 },
  tilak: { top: 13, width: 5 },
  garland: { top: 24, width: 29 },
};

export default function Adjust() {
  const { config, refresh, t, assetUrl } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pin } = useLocalSearchParams<{ pin: string }>();
  const { width: SW, height: SH } = useWindowDimensions();

  const initial = useMemo<StagePositions>(() => {
    const p = config?.positions || {};
    return {
      idol: { ...DEFAULTS.idol!, ...(p.idol || {}) },
      crown: { ...DEFAULTS.crown!, ...(p.crown || {}) },
      tilak: { ...DEFAULTS.tilak!, ...(p.tilak || {}) },
      garland: { ...DEFAULTS.garland!, ...(p.garland || {}) },
      plate: p.plate,
      bed: p.bed,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pos, setPos] = useState<StagePositions>(initial);
  const [saved, setSaved] = useState(false);

  const set = (group: keyof StagePositions, key: string, delta: number, min: number, max: number) => {
    Haptics.selectionAsync();
    setSaved(false);
    setPos((prev) => {
      const cur = (prev[group] as any) || {};
      const next = Math.max(min, Math.min(max, (cur[key] ?? 0) + delta));
      return { ...prev, [group]: { ...cur, [key]: next } };
    });
  };

  const save = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await fetch(`${BACKEND}/api/gopal/config/positions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Admin-Pin": String(pin || "") },
        body: JSON.stringify({ positions: pos }),
      });
      await refresh();
      setSaved(true);
    } catch {
      // ignore
    }
  };

  const reset = () => {
    Haptics.selectionAsync();
    setSaved(false);
    setPos({ ...DEFAULTS, plate: pos.plate, bed: pos.bed });
  };

  // preview geometry mirrors the real screen proportions
  const idol = pos.idol!;
  const idolWpx = SW * (idol.width / 100);
  const idolHpx = SH * (idol.height / 100);
  const previewMaxW = SW - SPACING.md * 2;
  const previewH = SH * 0.42;
  const scale = Math.min(previewMaxW / idolWpx, previewH / idolHpx, 1.4);
  const stageW = idolWpx * scale;
  const stageH = idolHpx * scale;

  const previewState = {
    dress: "idol",
    tilak: true,
    crown: true,
    garland: true,
    flowers: 0,
    bhog: null,
    sleeping: false,
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Text style={styles.h1}>{t("editor_title")}</Text>
        <Pressable testID="adjust-close-btn" onPress={() => router.back()} style={styles.ctrlBtn}>
          <MaterialCommunityIcons name="close" size={22} color={COLORS.maroon} />
        </Pressable>
      </View>

      {/* Live preview */}
      <View style={[styles.previewBox, { height: previewH + SPACING.lg }]}>
        <LinearGradient colors={["#FFE7B8", "#F6B24B", "#E8821E"]} style={StyleSheet.absoluteFill} />
        <View style={{ transform: [{ translateY: (idol.offsetY / 100) * SH * scale }] }}>
          <GopalStage
            key={`${idol.width}-${idol.height}`}
            W={stageW}
            H={stageH}
            positions={pos}
            state={previewState}
            assetUrl={assetUrl}
            animateOrnaments={false}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hint}>{t("ed_hint")}</Text>

        <Section icon="human-child" title={t("ed_gopal")}>
          <StepRow tk="gopal-width" label={t("ed_width")} value={idol.width} onChange={(d) => set("idol", "width", d, 30, 100)} />
          <StepRow tk="gopal-height" label={t("ed_height")} value={idol.height} onChange={(d) => set("idol", "height", d, 25, 80)} />
          <StepRow tk="gopal-offset" label={t("ed_vertical")} value={idol.offsetY} onChange={(d) => set("idol", "offsetY", d, -25, 25)} />
        </Section>

        <Section icon="crown" title={t("ed_mukut")}>
          <StepRow tk="mukut-top" label={t("ed_top")} value={pos.crown!.top} onChange={(d) => set("crown", "top", d, -20, 45)} />
          <StepRow tk="mukut-size" label={t("ed_size")} value={pos.crown!.width} onChange={(d) => set("crown", "width", d, 10, 70)} />
        </Section>

        <Section icon="brush" title={t("ed_tilak")}>
          <StepRow tk="tilak-top" label={t("ed_top")} value={pos.tilak!.top} onChange={(d) => set("tilak", "top", d, 0, 45)} />
          <StepRow tk="tilak-size" label={t("ed_size")} value={pos.tilak!.width} onChange={(d) => set("tilak", "width", d, 3, 14)} />
        </Section>

        <Section icon="flower-poppy" title={t("ed_mala")}>
          <StepRow tk="mala-top" label={t("ed_top")} value={pos.garland!.top} onChange={(d) => set("garland", "top", d, 0, 60)} />
          <StepRow tk="mala-size" label={t("ed_size")} value={pos.garland!.width} onChange={(d) => set("garland", "width", d, 10, 70)} />
        </Section>

        <Pressable testID="adjust-reset-btn" onPress={reset} style={styles.resetBtn}>
          <MaterialCommunityIcons name="backup-restore" size={18} color={COLORS.maroon} />
          <Text style={styles.resetText}>{t("ed_reset")}</Text>
        </Pressable>
      </ScrollView>

      {/* Save bar */}
      <View style={[styles.saveBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <Pressable testID="adjust-save-btn" onPress={save} style={styles.saveBtn}>
          <MaterialCommunityIcons name={saved ? "check-circle" : "content-save"} size={20} color="#fff" />
          <Text style={styles.saveText}>{saved ? t("ed_saved") : t("ed_save")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <MaterialCommunityIcons name={icon as any} size={20} color={COLORS.saffronDark} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function StepRow({ tk, label, value, onChange }: { tk: string; label: string; value: number; onChange: (delta: number) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.stepper}>
        <StepBtn text="−5" onPress={() => onChange(-5)} testID={`step-${tk}-minus5`} />
        <StepBtn text="−1" onPress={() => onChange(-1)} testID={`step-${tk}-minus1`} />
        <View style={styles.valueBox}>
          <Text style={styles.valueText} testID={`value-${tk}`}>{Math.round(value)}</Text>
        </View>
        <StepBtn text="+1" onPress={() => onChange(1)} testID={`step-${tk}-plus1`} />
        <StepBtn text="+5" onPress={() => onChange(5)} testID={`step-${tk}-plus5`} />
      </View>
    </View>
  );
}

function StepBtn({ text, onPress, testID }: { text: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.stepBtn}>
      <Text style={styles.stepBtnText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  h1: { fontSize: 22, fontWeight: "800", color: COLORS.maroon },
  ctrlBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...SHADOW.soft },

  previewBox: { marginHorizontal: SPACING.md, borderRadius: RADIUS.lg, overflow: "hidden", alignItems: "center", justifyContent: "center", ...SHADOW.card },

  hint: { fontSize: 12, fontWeight: "600", color: COLORS.saffronDark, textAlign: "center", marginBottom: SPACING.md },

  section: { backgroundColor: "#fff", borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOW.soft },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: SPACING.xs, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: COLORS.maroon },

  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { fontSize: 14, fontWeight: "700", color: COLORS.ink, flex: 1 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.goldSoft, alignItems: "center", justifyContent: "center" },
  stepBtnText: { fontSize: 14, fontWeight: "800", color: COLORS.maroon },
  valueBox: { minWidth: 42, height: 34, borderRadius: 10, backgroundColor: COLORS.cream, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: COLORS.creamDim },
  valueText: { fontSize: 15, fontWeight: "800", color: COLORS.maroon },

  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.xs, alignSelf: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill, backgroundColor: COLORS.creamDim, marginTop: SPACING.xs },
  resetText: { fontSize: 14, fontWeight: "700", color: COLORS.maroon },

  saveBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, backgroundColor: "rgba(255,246,230,0.96)", borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, ...SHADOW.card },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.xs, backgroundColor: COLORS.saffron, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
