import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { storage } from "@/src/utils/storage";
import { audio } from "@/src/audio";
import { tr, type Lang } from "@/src/i18n";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export interface GopalConfig {
  assets: Record<string, string | null>;
  sounds: Record<string, string | null>;
  positions: Record<string, { top: number; width: number }>;
}

interface Ctx {
  config: GopalConfig | null;
  loading: boolean;
  refresh: () => Promise<void>;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  soundOn: boolean;
  musicOn: boolean;
  toggleSound: () => void;
  toggleMusic: () => void;
  assetUrl: (slot: string) => string | null;
  soundUrl: (slot: string) => string | null;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<GopalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Lang>("bn");
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/api/gopal/config`);
      const data = await res.json();
      setConfig(data);
      await storage.setItem("gopal_config_cache", data);
    } catch {
      const cached = await storage.getItem<any>("gopal_config_cache", null);
      if (cached) setConfig(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const savedLang = await storage.getItem<Lang>("gopal_lang", "bn");
      const savedSound = await storage.getItem<boolean>("gopal_sound", true);
      const savedMusic = await storage.getItem<boolean>("gopal_music", true);
      if (savedLang) setLangState(savedLang);
      setSoundOn(savedSound ?? true);
      setMusicOn(savedMusic ?? true);
      audio.setSoundOn(savedSound ?? true);
      audio.setMusicOn(savedMusic ?? true);
      await refresh();
    })();
  }, [refresh]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.setItem("gopal_lang", l);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      audio.setSoundOn(next);
      storage.setItem("gopal_sound", next);
      return next;
    });
  }, []);

  const toggleMusic = useCallback(() => {
    setMusicOn((prev) => {
      const next = !prev;
      audio.setMusicOn(next);
      storage.setItem("gopal_music", next);
      return next;
    });
  }, []);

  const assetUrl = useCallback(
    (slot: string) => {
      const p = config?.assets?.[slot];
      return p ? `${BACKEND}${p}` : null;
    },
    [config],
  );

  const soundUrl = useCallback(
    (slot: string) => {
      const p = config?.sounds?.[slot];
      return p ? `${BACKEND}${p}` : null;
    },
    [config],
  );

  const value = useMemo<Ctx>(
    () => ({
      config,
      loading,
      refresh,
      lang,
      setLang,
      t: (key: string) => tr(lang, key),
      soundOn,
      musicOn,
      toggleSound,
      toggleMusic,
      assetUrl,
      soundUrl,
    }),
    [config, loading, refresh, lang, setLang, soundOn, musicOn, toggleSound, toggleMusic, assetUrl, soundUrl],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
