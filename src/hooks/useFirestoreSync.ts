"use client";

import { useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, collection as fsCollection, getDocs, writeBatch } from "firebase/firestore";
import { foyerKey } from "@/lib/storage";
import type { Category } from "@/lib/types";

export function useFirestoreSync() {
  const { user } = useAuth();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownCatIds = useRef<Set<string>>(new Set());
  const knownSiteIds = useRef<Map<string, Set<string>>>(new Map());
  // Tracks whether we've ever populated knownIds in this session.
  // If false, syncNow will read Firestore first before writing (hydrate-on-first-sync).
  const hydratedRef = useRef<boolean>(false);

  const scheduleSync = useCallback((categories: Category[]) => {
    if (!user) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => syncNow(categories), 2000);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncNow = useCallback(async (categories: Category[]) => {
    if (!user) return;
    const uid = user.uid;

    try {
      // ── Hydrate-on-first-sync ────────────────────────────────────────────
      // On a fresh mount the knownCatIds/knownSiteIds refs are empty.
      // Before we write anything, read the current Firestore state so the
      // cleanup loop has accurate data and won't leave orphaned documents.
      if (!hydratedRef.current) {
        const catsSnap = await getDocs(fsCollection(db, "users", uid, "categories"));
        const freshCatIds = new Set<string>();
        const freshSiteIds = new Map<string, Set<string>>();
        for (const catDoc of catsSnap.docs) {
          freshCatIds.add(catDoc.id);
          const sitesSnap = await getDocs(
            fsCollection(db, "users", uid, "categories", catDoc.id, "websites")
          );
          freshSiteIds.set(catDoc.id, new Set(sitesSnap.docs.map((s) => s.id)));
        }
        // Only overwrite refs if they're still empty (initKnownIds may have
        // run concurrently during an initial load — don't clobber that).
        if (knownCatIds.current.size === 0) knownCatIds.current = freshCatIds;
        if (knownSiteIds.current.size === 0) knownSiteIds.current = freshSiteIds;
        hydratedRef.current = true;
      }

      const batch = writeBatch(db);
      const currentCatIds = new Set(categories.map((c) => c.id));

      for (const oldCatId of knownCatIds.current) {
        if (!currentCatIds.has(oldCatId)) {
          batch.delete(doc(db, "users", uid, "categories", oldCatId));
          const oldSites = knownSiteIds.current.get(oldCatId) || new Set();
          for (const siteId of oldSites) {
            batch.delete(doc(db, "users", uid, "categories", oldCatId, "websites", siteId));
          }
          knownSiteIds.current.delete(oldCatId);
        }
      }

      categories.forEach((cat, catIdx) => {
        if (!cat.id) cat.id = crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

        batch.set(doc(db, "users", uid, "categories", cat.id), {
          name: cat.name, icon: cat.icon || "", orderIndex: catIdx,
        });

        const curSiteIds = new Set<string>();
        const knownSites = knownSiteIds.current.get(cat.id) || new Set();

        cat.websites.forEach((site, siteIdx) => {
          if (!site.id) site.id = crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
          curSiteIds.add(site.id);
          batch.set(doc(db, "users", uid, "categories", cat.id, "websites", site.id), {
            name: site.name, url: site.url, domain: site.domain,
            customIcon: site.customIcon || "", orderIndex: siteIdx,
          });
        });

        for (const oldId of knownSites) {
          if (!curSiteIds.has(oldId)) {
            batch.delete(doc(db, "users", uid, "categories", cat.id, "websites", oldId));
          }
        }
        knownSiteIds.current.set(cat.id, curSiteIds);
      });

      // Read settings with scoped key first, fall back to legacy unscoped key
      const getLocal = (key: string) =>
        localStorage.getItem(foyerKey(key, uid)) ??
        localStorage.getItem(key) ??
        null;

      const widgetKeys = ["clock", "calendar", "weather", "news", "search"];
      const widgets: Record<string, boolean> = {};
      widgetKeys.forEach((key) => {
        const val = getLocal(`widget_${key}`);
        widgets[key] = val !== null ? val === "true" : true;
      });

      const weatherLocationRaw = getLocal("weather_location");
      let weatherLocation = null;
      if (weatherLocationRaw) {
        try { weatherLocation = JSON.parse(weatherLocationRaw); } catch { /* ignore */ }
      }

      batch.set(doc(db, "users", uid), {
        settings: {
          wallpaperEnabled: getLocal("wallpaperEnabled") !== "false",
          selectedSearchEngine: getLocal("selectedSearchEngine") || "google",
          lastWallpaperKeyword: getLocal("lastWallpaperKeyword") || "",
          customWallpaperKeywords: getLocal("customWallpaperKeywords") || "",
          googleAiMode: getLocal("googleAiMode") === "true",
          widgets,
          weatherLocation,
        },
      }, { merge: true });

      await batch.commit();
      knownCatIds.current = currentCatIds;
    } catch (err) {
      console.error("Foyer: Firestore sync failed:", err);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const forceSync = useCallback(async (categories: Category[]) => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    await syncNow(categories);
  }, [syncNow]);

  const initKnownIds = useCallback((categories: Category[]) => {
    knownCatIds.current = new Set(categories.map((c) => c.id));
    knownSiteIds.current = new Map();
    categories.forEach((c) => {
      knownSiteIds.current.set(c.id, new Set(c.websites.map((s) => s.id)));
    });
    // Mark as hydrated — we have accurate known IDs from the loaded data.
    hydratedRef.current = true;
  }, []);

  return { scheduleSync, forceSync, initKnownIds };
}
