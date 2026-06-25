"use client";

import { useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, writeBatch } from "firebase/firestore";
import { foyerKey } from "@/lib/storage";
import type { Category } from "@/lib/types";

export function useFirestoreSync() {
  const { user } = useAuth();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownCatIds = useRef<Set<string>>(new Set());
  const knownSiteIds = useRef<Map<string, Set<string>>>(new Map());

  const scheduleSync = useCallback((categories: Category[]) => {
    if (!user) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => syncNow(categories), 2000);
  }, [user]);

  const syncNow = useCallback(async (categories: Category[]) => {
    if (!user) return;
    const uid = user.uid;

    try {
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

      batch.set(doc(db, "users", uid), {
        settings: {
          wallpaperEnabled: getLocal("wallpaperEnabled") !== "false",
          selectedSearchEngine: getLocal("selectedSearchEngine") || "google",
          lastWallpaperKeyword: getLocal("lastWallpaperKeyword") || "",
          customWallpaperKeywords: getLocal("customWallpaperKeywords") || "",
        },
      }, { merge: true });

      await batch.commit();
      knownCatIds.current = currentCatIds;
    } catch (err) {
      console.error("Foyer: Firestore sync failed:", err);
    }
  }, [user]);

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
  }, []);

  return { scheduleSync, forceSync, initKnownIds };
}
