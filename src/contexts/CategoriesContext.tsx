"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, collection as fsCollection, getDocs } from "firebase/firestore";
import { useFirestoreSync } from "@/hooks/useFirestoreSync";
import { defaultCategories } from "@/lib/defaults";
import { generateSiteId, generateCategoryId, getRootDomain } from "@/lib/utils";
import { foyerKey } from "@/lib/storage";
import { classifySite } from "@/lib/classifySite";
import { normalizeUrl } from "@/lib/normalizeUrl";
import type { Category, Website, ParsedBookmark } from "@/lib/types";

interface CategoriesContextValue {
  categories: Category[];
  loading: boolean;
  addSite: (name: string, url: string, categoryId: string, customIcon?: string) => void;
  editSite: (catIndex: number, siteIndex: number, updates: Partial<Website>) => void;
  deleteSite: (catIndex: number, siteIndex: number) => void;
  moveSite: (fromCatIdx: number, fromSiteIdx: number, toCatIdx: number, toSiteIdx: number) => void;
  addCategory: (name: string, icon: string) => void;
  editCategory: (catIndex: number, name: string, icon: string) => void;
  deleteCategory: (catIndex: number) => void;
  reorderCategories: (fromIdx: number, toIdx: number) => void;
  replaceAll: (newCategories: Category[]) => void;
  save: () => void;
  importBookmarks: (
    bookmarks: ParsedBookmark[],
    opts?: { autoCreateCategories?: boolean }
  ) => { added: number; skipped: number; uncategorized: ParsedBookmark[]; createdCategories: string[] };
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { scheduleSync, forceSync, initKnownIds } = useFirestoreSync();

  const prevUidRef = useRef<string | null>(null);
  const uidRef = useRef<string | null>(null);
  uidRef.current = user?.uid || null;

  // Unified loading effect — gated on auth resolution to avoid stale-key reads and double-renders.
  // Uses a `cancelled` flag so stale async Firestore responses can't race after user changes.
  useEffect(() => {
    // Wait until Firebase Auth has resolved — prevents reading the wrong localStorage key
    // while user is transiently null during the auth handshake.
    if (authLoading) return;

    let cancelled = false;

    if (!user) {
      // ── Unauthenticated path ─────────────────────────────────────────────
      // Read from the anonymous-scoped key (or legacy bare key).
      const key = foyerKey("categories", null);
      const local = localStorage.getItem(key) || localStorage.getItem("categories");
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            parsed.forEach((c: any) => { if (!c.websites) c.websites = []; });
            if (!cancelled) setCategories(parsed);
          }
        } catch { /* ignore parse errors */ }
      } else {
        // First-ever visit — seed with defaults
        if (!cancelled) setCategories(JSON.parse(JSON.stringify(defaultCategories)));
      }
      if (!cancelled) setLoading(false);
      return;
    }

    // ── Authenticated path ───────────────────────────────────────────────
    const uid = user.uid;

    // Clear state when the logged-in user changes
    if (prevUidRef.current !== null && prevUidRef.current !== uid) {
      setCategories([]);
      setLoading(true);
    }
    prevUidRef.current = uid;

    const catKey = foyerKey("categories", uid);

    (async () => {
      try {
        const catsSnap = await getDocs(fsCollection(db, "users", uid, "categories"));
        if (cancelled) return;

        if (!catsSnap.empty) {
          const sortedCats = catsSnap.docs
            .sort((a, b) => (a.data().orderIndex ?? 999) - (b.data().orderIndex ?? 999))
            .map((d) => ({ id: d.id, name: d.data().name, icon: d.data().icon }));
          const loaded: Category[] = [];
          for (const cat of sortedCats) {
            const sitesSnap = await getDocs(fsCollection(db, "users", uid, "categories", cat.id, "websites"));
            const sortedSites = sitesSnap.docs
              .sort((a, b) => (a.data().orderIndex ?? 999) - (b.data().orderIndex ?? 999))
              .map((s) => ({ id: s.id, name: s.data().name, url: s.data().url, domain: s.data().domain, customIcon: s.data().customIcon } as Website));
            loaded.push({ id: cat.id, name: cat.name, icon: cat.icon || "", websites: sortedSites });
          }
          if (cancelled) return;

          // ── Dedup pass ──────────────────────────────────────────────────
          // Firestore may have accumulated duplicate sites (same URL in the
          // same category) from past bad syncs. Deduplicate by URL, keeping
          // the entry with the lowest orderIndex (i.e. first in the sorted
          // list). If any dupes are found, write the cleaned data back.
          let dedupNeeded = false;
          const deduped = loaded.map((cat) => {
            const seen = new Map<string, Website>();
            for (const site of cat.websites) {
              const key = site.url.trim().toLowerCase();
              if (!seen.has(key)) {
                seen.set(key, site);
              } else {
                dedupNeeded = true;
              }
            }
            return { ...cat, websites: Array.from(seen.values()) };
          });

          setCategories(deduped);
          localStorage.setItem(catKey, JSON.stringify(deduped));
          initKnownIds(deduped);
          if (dedupNeeded) {
            console.info("Foyer: deduplicated sites detected and cleaned.");
            await forceSync(deduped);
          }
        } else {
          // First visit for this user — Firestore empty, seed defaults
          const data: Category[] = JSON.parse(JSON.stringify(defaultCategories));
          data.forEach((c) => c.websites.forEach((s) => { if (!s.id) s.id = generateSiteId(); }));
          if (cancelled) return;
          setCategories(data);
          localStorage.setItem(catKey, JSON.stringify(data));
          initKnownIds(data);
          await forceSync(data);
        }
      } catch (err) {
        console.error("Firestore load failed, falling back to localStorage:", err);
        if (cancelled) return;
        const local = localStorage.getItem(catKey) || localStorage.getItem("categories");
        if (local) {
          try { setCategories(JSON.parse(local)); } catch { /* ignore */ }
        } else {
          setCategories(JSON.parse(JSON.stringify(defaultCategories)));
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback((newCats: Category[]) => {
    setCategories(newCats);
    localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(newCats));
    scheduleSync(newCats);
  }, [scheduleSync]);

  const addSite = useCallback((name: string, url: string, categoryId: string, customIcon?: string) => {
    setCategories((prev) => {
      const next = prev.map((c) => ({ ...c, websites: [...c.websites] }));
      const cat = next.find((c) => c.id === categoryId);
      if (!cat) return prev;
      const domain = getRootDomain(url);
      cat.websites.push({ id: generateSiteId(), name, url, domain, customIcon: customIcon || "" });
      localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
      scheduleSync(next);
      return next;
    });
  }, [scheduleSync]);

  const editSite = useCallback((catIndex: number, siteIndex: number, updates: Partial<Website>) => {
    setCategories((prev) => {
      const next = prev.map((c) => ({ ...c, websites: [...c.websites] }));
      Object.assign(next[catIndex].websites[siteIndex], updates);
      localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
      scheduleSync(next);
      return next;
    });
  }, [scheduleSync]);

  const deleteSite = useCallback((catIndex: number, siteIndex: number) => {
    setCategories((prev) => {
      const next = prev.map((c) => ({ ...c, websites: [...c.websites] }));
      next[catIndex].websites.splice(siteIndex, 1);
      localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
      scheduleSync(next);
      return next;
    });
  }, [scheduleSync]);

  const moveSite = useCallback((fromCatIdx: number, fromSiteIdx: number, toCatIdx: number, toSiteIdx: number) => {
    setCategories((prev) => {
      const next = prev.map((c) => ({ ...c, websites: [...c.websites] }));
      const [site] = next[fromCatIdx].websites.splice(fromSiteIdx, 1);
      const adjustedIdx = fromCatIdx === toCatIdx && fromSiteIdx < toSiteIdx ? toSiteIdx - 1 : toSiteIdx;
      next[toCatIdx].websites.splice(adjustedIdx, 0, site);
      localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
      scheduleSync(next);
      return next;
    });
  }, [scheduleSync]);

  const addCategory = useCallback((name: string, icon: string) => {
    setCategories((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const newCat: Category = { id: generateCategoryId(name, existingIds), name, icon: icon || name.charAt(0).toUpperCase() || "📁", websites: [] };
      const next = [...prev, newCat];
      localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
      scheduleSync(next);
      return next;
    });
  }, [scheduleSync]);

  const editCategory = useCallback((catIndex: number, name: string, icon: string) => {
    setCategories((prev) => {
      const next = [...prev];
      next[catIndex] = { ...next[catIndex], name, icon };
      localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
      scheduleSync(next);
      return next;
    });
  }, [scheduleSync]);

  const deleteCategory = useCallback((catIndex: number) => {
    setCategories((prev) => {
      const next = prev.filter((_, i) => i !== catIndex);
      localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
      scheduleSync(next);
      return next;
    });
  }, [scheduleSync]);

  const reorderCategories = useCallback((fromIdx: number, toIdx: number) => {
    setCategories((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
      scheduleSync(next);
      return next;
    });
  }, [scheduleSync]);

  const replaceAll = useCallback((newCats: Category[]) => {
    setCategories(newCats);
    localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(newCats));
    forceSync(newCats);
  }, [forceSync]);

  const save = useCallback(() => {
    setCategories((prev) => {
      scheduleSync(prev);
      localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(prev));
      return prev;
    });
  }, [scheduleSync]);

  const importBookmarks = useCallback((
    bookmarks: ParsedBookmark[],
    opts?: { autoCreateCategories?: boolean }
  ): { added: number; skipped: number; uncategorized: ParsedBookmark[]; createdCategories: string[] } => {
    const autoCreate = opts?.autoCreateCategories ?? false;

    // Capture the current categories synchronously to compute the result
    let currentCats: Category[] = [];
    setCategories((prev) => { currentCats = prev; return prev; });

    const result = { added: 0, skipped: 0, uncategorized: [] as ParsedBookmark[], createdCategories: [] as string[] };
    const next = currentCats.map((c) => ({ ...c, websites: [...c.websites] }));
    const existingUrls = new Set<string>();
    const existingIds = new Set(next.map((c) => c.id));
    for (const cat of next) {
      for (const site of cat.websites) {
        existingUrls.add(normalizeUrl(site.url));
      }
    }

    for (const bookmark of bookmarks) {
      const normalUrl = normalizeUrl(bookmark.url);
      if (existingUrls.has(normalUrl)) {
        result.skipped++;
        continue;
      }

      const classification = classifySite(bookmark.title, bookmark.url, next, bookmark.folder);

      let categoryId = classification.categoryId;
      if (!categoryId && autoCreate && classification.suggestedCategoryName) {
        const newId = generateCategoryId(classification.suggestedCategoryName, existingIds);
        const newCategory: Category = {
          id: newId,
          name: classification.suggestedCategoryName,
          icon: classification.suggestedCategoryName.charAt(0).toUpperCase() || "📁",
          websites: [],
        };
        next.push(newCategory);
        existingIds.add(newId);
        categoryId = newId;
        result.createdCategories.push(classification.suggestedCategoryName);
      }

      if (categoryId) {
        const cat = next.find((c) => c.id === categoryId);
        if (cat) {
          const domain = getRootDomain(bookmark.url);
          cat.websites.push({
            id: generateSiteId(),
            name: bookmark.title,
            url: bookmark.url,
            domain,
            customIcon: bookmark.icon || "",
          });
          existingUrls.add(normalUrl);
          result.added++;
        } else {
          result.uncategorized.push(bookmark);
        }
      } else {
        result.uncategorized.push(bookmark);
      }
    }

    setCategories(next);
    localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
    scheduleSync(next);
    return result;
  }, [scheduleSync]);

  return (
    <CategoriesContext.Provider value={{
      categories, loading,
      addSite, editSite, deleteSite, moveSite,
      addCategory, editCategory, deleteCategory, reorderCategories,
      replaceAll, save,
      importBookmarks,
    }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used within a CategoriesProvider");
  return ctx;
}
