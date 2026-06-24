"use client";

import { useState, useCallback, useEffect } from "react";
import { UNSPLASH_CONFIG, WALLPAPER_CACHE_KEY } from "@/lib/constants";
import type { CachedWallpaper } from "@/lib/types";

export function useWallpaper() {
  const [enabled, setEnabled] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("wallpaperEnabled") !== "false" : true
  );
  const [photo, setPhoto] = useState<CachedWallpaper | null>(null);
  const [loading, setLoading] = useState(false);

  const getRandomKeyword = useCallback(() => {
    const custom = localStorage.getItem("customWallpaperKeywords");
    const source = custom || UNSPLASH_CONFIG.query;
    const keywords = source.split(",").map((k) => k.trim()).filter(Boolean);
    const lastKeyword = localStorage.getItem("lastWallpaperKeyword") || "";
    if (keywords.length <= 1) return keywords[0] || "nature";
    const available = keywords.filter((k) => k.toLowerCase() !== lastKeyword.toLowerCase());
    const selected = available[Math.floor(Math.random() * available.length)] || keywords[0];
    localStorage.setItem("lastWallpaperKeyword", selected);
    return selected;
  }, []);

  const applyPhoto = useCallback((photoData: CachedWallpaper, previewUrl: string, highResUrl?: string) => {
    setPhoto(photoData);

    const bg = document.getElementById("wallpaperBackground");
    const credit = document.getElementById("photoCredit");
    const plink = document.getElementById("photographerLink") as HTMLAnchorElement | null;
    const ilink = document.getElementById("imageLink") as HTMLAnchorElement | null;

    if (!bg) return;
    bg.style.backgroundImage = `url(${previewUrl})`;
    bg.classList.add("loaded");
    document.body.classList.add("wallpaper-active");

    if (plink && credit) {
      plink.textContent = photoData.photographerName;
      plink.href = photoData.photographerUrl;
      credit.classList.add("visible");
    }
    if (ilink) {
      ilink.href = photoData.photoUrl;
      ilink.classList.remove("heart-liked");
      try {
        const liked = JSON.parse(localStorage.getItem("unsplash_liked_photos") || "[]");
        if (liked.includes(photoData.id)) ilink.classList.add("heart-liked");
      } catch { /* ignore */ }
    }
    (window as any).currentUnsplashPhotoId = photoData.id;
    (window as any).currentUnsplashPhotoUrl = photoData.photoUrl;
    if (highResUrl) {
      const img = new Image();
      img.decoding = "async";
      (img as any).fetchPriority = "low";
      img.onload = () => { bg.style.backgroundImage = `url(${highResUrl})`; };
      img.src = highResUrl;
    }
  }, []);

  const restoreCached = useCallback((): boolean => {
    try {
      const cached = JSON.parse(localStorage.getItem(WALLPAPER_CACHE_KEY) || "null");
      if (!cached?.previewUrl) return false;
      applyPhoto(cached, cached.previewUrl, cached.highResUrl);
      return true;
    } catch {
      return false;
    }
  }, [applyPhoto]);

  const fetchWallpaper = useCallback(async () => {
    if (!UNSPLASH_CONFIG.accessKey) return;
    setLoading(true);
    try {
      const keyword = getRandomKeyword();
      const orientation = window.innerHeight > window.innerWidth ? "portrait" : "landscape";
      const res = await fetch(
        `https://api.unsplash.com/photos/random?orientation=${orientation}&query=${encodeURIComponent(keyword)}`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_CONFIG.accessKey}` } }
      );
      if (!res.ok) throw new Error(`Unsplash API error: ${res.status}`);
      const data = await res.json();
      const optimalWidth = window.innerWidth <= 768 ? 1080 : 1920;
      const highResUrl = `${data.urls.raw}&auto=format&fit=crop&w=${optimalWidth}&q=75`;
      const photoData: CachedWallpaper = {
        id: data.id,
        photoUrl: `${data.links.html}?utm_source=foyer&utm_medium=referral`,
        photographerName: data.user.name,
        photographerUrl: `${data.user.links.html}?utm_source=homepage&utm_medium=referral`,
        previewUrl: data.urls.small || data.urls.thumb,
        highResUrl,
      };
      localStorage.setItem(WALLPAPER_CACHE_KEY, JSON.stringify(photoData));
      applyPhoto(photoData, photoData.previewUrl, highResUrl);
    } catch (err) {
      console.error("Failed to fetch Unsplash wallpaper:", err);
    } finally {
      setLoading(false);
    }
  }, [getRandomKeyword, applyPhoto]);

  const toggleWallpaper = useCallback(() => {
    if (!enabled) {
      setEnabled(true);
      localStorage.setItem("wallpaperEnabled", "true");
      const toggle = document.getElementById("wallpaperToggle");
      toggle?.classList.remove("disabled");
    }
    fetchWallpaper();
  }, [enabled, fetchWallpaper]);

  const disableWallpaper = useCallback(() => {
    const bg = document.getElementById("wallpaperBackground");
    const credit = document.getElementById("photoCredit");
    bg?.classList.remove("loaded");
    bg?.style.setProperty("background-image", "");
    credit?.classList.remove("visible");
    document.body.classList.remove("wallpaper-active");
    setPhoto(null);
  }, []);

  useEffect(() => {
    if (enabled) {
      if (!restoreCached()) fetchWallpaper();
    } else {
      disableWallpaper();
    }
  }, []);

  return {
    enabled,
    photo,
    loading,
    fetchWallpaper,
    toggleWallpaper,
    disableWallpaper,
  };
}
