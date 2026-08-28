import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Stack, useRouter } from "expo-router";

import { useApp } from "@/src/AppContext";
import { COLORS, RADIUS, SHADOW, SPACING } from "@/src/theme";
import { KeyboardAwareScrollWrapper } from "@/src/components/KeyboardAware";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const IMAGE_SLOTS = [
  "background", "idol", "idol_blue", "idol_pink", "crown", "garland", "diya",
  "bell", "bed", "plate", "flower", "makhan", "laddu", "mishri", "fruits",
];
const SOUND_SLOTS = ["bell", "water", "aarti", "lullaby", "bg_music"];

export default function Admin() {
  const { config, refresh, t, assetUrl } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [seed, setSeed] = useState<{ status: string; current: number; total: number } | null>(null);

  const verify = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/api/gopal/admin/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        setUnlocked(true);
        setErr(false);
      } else setErr(true);
    } catch {
      setErr(true);
    }
  }, [pin]);

  const uploadImage = async (slot: string) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (res.canceled || !res.assets?.length) return;
    await doUpload("image", slot, res.assets[0].uri, res.assets[0].fileName || `${slot}.png`, res.assets[0].mimeType || "image/png");
  };

  const uploadSound = async (slot: string) => {
    const res = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    await doUpload("sound", slot, res.assets[0].uri, res.assets[0].name || `${slot}.mp3`, res.assets[0].mimeType || "audio/mpeg");
  };

  const doUpload = async (kind: string, slot: string, uri: string, name: string, type: string) => {
    setBusy(`${kind}-${slot}`);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("slot", slot);
      if (Platform.OS === "web") {
        const blob = await (await fetch(uri)).blob();
        form.append("file", blob, name);
      } else {
        form.append("file", { uri, name, type } as any);
      }
      await fetch(`${BACKEND}/api/gopal/upload`, {
        method: "POST",
        headers: { "X-Admin-Pin": pin },
        body: form,
      });
      await refresh();
    } catch {
      // ignore
    } finally {
      setBusy(null);
    }
  };

  const runSeed = async () => {
    await fetch(`${BACKEND}/api/gopal/seed`, { method: "POST", headers: { "X-Admin-Pin": pin } });
    setSeed({ status: "running", current: 0, total: 0 });
  };

  useEffect(() => {
    if (!seed || seed.status !== "running") return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`${BACKEND}/api/gopal/seed/status`);
        const d = await r.json();
        setSeed(d);
        if (d.status === "done" || d.status === "error") {
          clearInterval(id);
          await refresh();
        }
      } catch {
        // ignore
      }
    }, 2500);
    return () => clearInterval(id);
  }, [seed?.status, refresh]);

  if (!unlocked) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.lockCard}>
          <MaterialCommunityIcons name="shield-lock" size={44} color={COLORS.saffron} />
          <Text style={styles.lockTitle}>{t("admin_title")}</Text>
          <TextInput
            testID="admin-pin-input"
            value={pin}
            onChangeText={setPin}
            placeholder={t("enter_pin")}
            placeholderTextColor="#B79B77"
            secureTextEntry
            keyboardType="number-pad"
            style={styles.pinInput}
          />
          {err && <Text style={styles.errText}>{t("wrong_pin")}</Text>}
          <Pressable testID="admin-unlock-btn" onPress={verify} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{t("unlock")}</Text>
          </Pressable>
          <Pressable testID="admin-back-btn" onPress={() => router.back()} style={styles.linkBtn}>
            <Text style={styles.linkText}>{t("back")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAwareScrollWrapper
        contentContainerStyle={{ paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.xl, paddingHorizontal: SPACING.md }}
      >
        <View style={styles.headerRow}>
          <Text style={styles.h1}>{t("admin_title")}</Text>
          <Pressable testID="admin-close-btn" onPress={() => router.back()} style={styles.ctrlBtn}>
            <MaterialCommunityIcons name="close" size={22} color={COLORS.maroon} />
          </Pressable>
        </View>

        {/* Seed */}
        <Pressable testID="generate-assets-btn" onPress={runSeed} style={styles.seedBtn} disabled={seed?.status === "running"}>
          <MaterialCommunityIcons name="auto-fix" size={20} color="#fff" />
          <Text style={styles.seedText}>
            {seed?.status === "running"
              ? `${t("generating")} ${seed.current}/${seed.total || "…"}`
              : t("generate_assets")}
          </Text>
          {seed?.status === "running" && <ActivityIndicator color="#fff" style={{ marginLeft: 8 }} />}
        </Pressable>

        {/* Images */}
        <Text style={styles.section}>{t("images")}</Text>
        <View style={styles.grid}>
          {IMAGE_SLOTS.map((slot) => {
            const uri = assetUrl(slot);
            return (
              <View key={slot} style={styles.slotCard}>
                <View style={styles.slotThumb}>
                  {uri ? (
                    <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                  ) : (
                    <MaterialCommunityIcons name="image-off-outline" size={26} color={COLORS.creamDim} />
                  )}
                </View>
                <Text style={styles.slotName} numberOfLines={1}>{slot}</Text>
                <Pressable testID={`upload-image-${slot}`} onPress={() => uploadImage(slot)} style={styles.uploadBtn}>
                  {busy === `image-${slot}` ? (
                    <ActivityIndicator color={COLORS.maroon} size="small" />
                  ) : (
                    <Text style={styles.uploadText}>{uri ? t("replace") : t("upload")}</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Sounds */}
        <Text style={styles.section}>{t("sounds")}</Text>
        <View style={styles.grid}>
          {SOUND_SLOTS.map((slot) => {
            const has = !!config?.sounds?.[slot];
            return (
              <View key={slot} style={styles.slotCard}>
                <View style={styles.slotThumb}>
                  <MaterialCommunityIcons
                    name={has ? "music-circle" : "music-note-off"}
                    size={30}
                    color={has ? COLORS.saffron : COLORS.creamDim}
                  />
                </View>
                <Text style={styles.slotName} numberOfLines={1}>{slot}</Text>
                <Pressable testID={`upload-sound-${slot}`} onPress={() => uploadSound(slot)} style={styles.uploadBtn}>
                  {busy === `sound-${slot}` ? (
                    <ActivityIndicator color={COLORS.maroon} size="small" />
                  ) : (
                    <Text style={styles.uploadText}>{has ? t("replace") : t("upload")}</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      </KeyboardAwareScrollWrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  lockCard: { backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: "center", width: "100%", maxWidth: 340, ...SHADOW.card },
  lockTitle: { fontSize: 20, fontWeight: "800", color: COLORS.maroon, marginTop: SPACING.md, marginBottom: SPACING.lg },
  pinInput: { width: "100%", borderWidth: 1.5, borderColor: COLORS.creamDim, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: 18, textAlign: "center", color: COLORS.ink, letterSpacing: 6 },
  errText: { color: "#C62828", marginTop: SPACING.sm, fontWeight: "600" },
  primaryBtn: { marginTop: SPACING.lg, backgroundColor: COLORS.saffron, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill, width: "100%", alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkBtn: { marginTop: SPACING.md },
  linkText: { color: COLORS.saffronDark, fontWeight: "600" },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md },
  h1: { fontSize: 24, fontWeight: "800", color: COLORS.maroon },
  ctrlBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...SHADOW.soft },

  seedBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.xs, backgroundColor: COLORS.maroon, paddingVertical: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.lg },
  seedText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  section: { fontSize: 16, fontWeight: "800", color: COLORS.saffronDark, marginTop: SPACING.md, marginBottom: SPACING.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  slotCard: { width: "31%", backgroundColor: "#fff", borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: "center", ...SHADOW.soft },
  slotThumb: { width: "100%", height: 72, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.cream, borderRadius: RADIUS.sm },
  slotName: { marginTop: 6, fontSize: 11, fontWeight: "700", color: COLORS.ink },
  uploadBtn: { marginTop: 6, backgroundColor: COLORS.goldSoft, paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADIUS.pill, minWidth: 70, alignItems: "center" },
  uploadText: { fontSize: 12, fontWeight: "700", color: COLORS.maroon },
});
