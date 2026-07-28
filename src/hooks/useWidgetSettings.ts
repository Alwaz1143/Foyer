"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { foyerKey } from "@/lib/storage";

export interface WidgetSettings {
  clock: boolean;
  calendar: boolean;
  weather: boolean;
  news: boolean;
  search: boolean;
}

const DEFAULTS: WidgetSettings = {
  clock: true,
  calendar: true,
  weather: true,
  news: true,
  search: true,
};

export function useWidgetSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<WidgetSettings>(DEFAULTS);

  const load = useCallback(() => {
    const uid = user?.uid;
    const s = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS) as (keyof WidgetSettings)[]) {
      const val = localStorage.getItem(foyerKey(`widget_${key}`, uid));
      if (val !== null) {
        (s as any)[key] = val === "true";
      }
    }
    setSettings(s);
  }, [user]);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("widgetsettingschange", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("widgetsettingschange", handler);
      window.removeEventListener("storage", handler);
    };
  }, [load]);

  const setSetting = useCallback(
    (key: keyof WidgetSettings, value: boolean) => {
      const uid = user?.uid;
      localStorage.setItem(foyerKey(`widget_${key}`, uid), String(value));
      setSettings((prev) => ({ ...prev, [key]: value }));
      window.dispatchEvent(new Event("widgetsettingschange"));
    },
    [user]
  );

  return { settings, setSetting };
}
