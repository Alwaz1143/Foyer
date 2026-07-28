"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { foyerKey } from "@/lib/storage";

export interface LocationData {
  lat: number;
  lon: number;
  city: string;
}

export function useLocation() {
  const { user } = useAuth();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const uidRef = useRef(user?.uid);
  uidRef.current = user?.uid;

  useEffect(() => {
    const uid = uidRef.current;
    let cancelled = false;

    const stored = localStorage.getItem(foyerKey("weather_location", uid));
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as LocationData;
        if (parsed.lat && parsed.lon) {
          setLocation(parsed);
          setLoading(false);
          return;
        }
      } catch {}
    }

    const save = (loc: LocationData) => {
      if (cancelled) return;
      localStorage.setItem(foyerKey("weather_location", uidRef.current), JSON.stringify(loc));
      setLocation(loc);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          const { latitude, longitude } = pos.coords;
          try {
            const res = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await res.json();
            if (cancelled) return;
            const city = data.city || data.locality || data.countryName || "Unknown";
            save({ lat: latitude, lon: longitude, city });
          } catch {
            if (!cancelled) save({ lat: latitude, lon: longitude, city: "Unknown" });
          }
          if (!cancelled) setLoading(false);
        },
        () => {
          if (!cancelled) {
            save({ lat: 40.7128, lon: -74.006, city: "New York" });
            setLoading(false);
          }
        },
        { timeout: 5000 }
      );
    } else {
      save({ lat: 40.7128, lon: -74.006, city: "New York" });
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const setCustomLocation = useCallback(async (city: string) => {
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`
      );
      const data = await res.json();
      if (data.results?.[0]) {
        const r = data.results[0];
        const loc = { lat: r.latitude, lon: r.longitude, city: r.name };
        localStorage.setItem(foyerKey("weather_location", uidRef.current), JSON.stringify(loc));
        setLocation(loc);
        return true;
      }
    } catch {}
    return false;
  }, []);

  return { location, loading, setCustomLocation };
}
