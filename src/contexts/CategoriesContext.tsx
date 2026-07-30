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
import type { ClassificationResult } from "@/lib/classifySite";

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
  importBookmarks: (
    bookmarks: ParsedBookmark[],
    opts?: { autoCreateCategories?: boolean; categoryOverrides?: Record<string, string>; autoImportHighConfidence?: boolean }
  ) => { added: number; skipped: number; uncategorized: ParsedBookmark[]; createdCategories: string[]; pending: { bookmark: ParsedBookmark; classification: ClassificationResult }[] };
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
  const categoriesRef = useRef<Category[]>(categories);
  categoriesRef.current = categories;

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

    // ── Instant paint from localStorage ─────────────────────────────────────
    // Show cached data immediately so the dashboard renders without waiting
    // for Firestore network round-trips.
    const cached = localStorage.getItem(catKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          parsed.forEach((c: any) => { if (!c.websites) c.websites = []; });
          if (!cancelled) setCategories(parsed);
        }
      } catch { /* ignore */ }
    }

    (async () => {
      try {
        const catsSnap = await getDocs(fsCollection(db, "users", uid, "categories"));
        if (cancelled) return;

        if (!catsSnap.empty) {
          const sortedCats = catsSnap.docs
            .sort((a, b) => (a.data().orderIndex ?? 999) - (b.data().orderIndex ?? 999))
            .map((d) => ({ id: d.id, name: d.data().name, icon: d.data().icon }));

          // ── Parallel fetch all websites ───────────────────────────────────
          // Fire all subcollection queries simultaneously instead of N+1
          // sequential round-trips.
          const sitesResults = await Promise.all(
            sortedCats.map((cat) =>
              getDocs(fsCollection(db, "users", uid, "categories", cat.id, "websites"))
            )
          );
          if (cancelled) return;

          const loaded: Category[] = sortedCats.map((cat, i) => {
            const sitesSnap = sitesResults[i];
            const sortedSites = sitesSnap.docs
              .sort((a, b) => (a.data().orderIndex ?? 999) - (b.data().orderIndex ?? 999))
              .map((s) => ({ id: s.id, name: s.data().name, url: s.data().url, domain: s.data().domain, customIcon: s.data().customIcon } as Website));
            return { id: cat.id, name: cat.name, icon: cat.icon || "", websites: sortedSites };
          });

          // ── Dedup pass ──────────────────────────────────────────────────
          // Firestore may have accumulated duplicate sites (same URL in the
          // same category) from past bad syncs. Deduplicate by URL, keeping
          // the entry with the lowest orderIndex (i.e. first in the sorted
          // list). If any dupes are found, write the cleaned data back.
          let dedupNeeded = false;
          const deduped = loaded.map((cat) => {
            const seen = new Map<string, Website>();
            for (const site of cat.websites) {
              const key = normalizeUrl(site.url);
              if (!seen.has(key)) {
                seen.set(key, site);
              } else {
                dedupNeeded = true;
              }
            }
            return { ...cat, websites: Array.from(seen.values()) };
          });

          if (cancelled) return;
          setCategories(deduped);
          localStorage.setItem(catKey, JSON.stringify(deduped));
          initKnownIds(deduped);
          if (dedupNeeded) {
            console.info("Foyer: deduplicated sites detected and cleaned.");
            await forceSync(deduped);
          }
        } else {
          // Firestore returned empty — could be a transient issue.
          // Check localStorage first before assuming this is a new user.
          const sentinelKey = foyerKey("defaultsSeeded", uid);
          const local = localStorage.getItem(catKey);
          if (local) {
            try {
              const parsed = JSON.parse(local);
              if (Array.isArray(parsed) && parsed.length > 0) {
                parsed.forEach((c: any) => { if (!c.websites) c.websites = []; });
                if (cancelled) return;
                setCategories(parsed);
                localStorage.setItem(catKey, JSON.stringify(parsed));
                initKnownIds(parsed);
                await forceSync(parsed);
                return;
              }
            } catch { /* ignore parse */ }
          }
          // Only seed defaults if no sentinel exists (prevents re-seeding
          // after a previous seed on a different device or cleared cache).
          if (localStorage.getItem(sentinelKey) === "true") return;
          const data: Category[] = JSON.parse(JSON.stringify(defaultCategories));
          data.forEach((c) => c.websites.forEach((s) => { if (!s.id) s.id = generateSiteId(); }));
          if (cancelled) return;
          setCategories(data);
          if (!localStorage.getItem(catKey)) {
            localStorage.setItem(catKey, JSON.stringify(data));
          }
          localStorage.setItem(sentinelKey, "true");
          initKnownIds(data);
          await forceSync(data);
        }
      } catch (err) {
        console.error("Firestore load failed, falling back to localStorage:", err);
        if (cancelled) return;
        const sentinelKey = foyerKey("defaultsSeeded", uid);
        const local = localStorage.getItem(catKey) || localStorage.getItem("categories");
        if (local) {
          try { setCategories(JSON.parse(local)); } catch { /* ignore */ }
        } else if (!localStorage.getItem(sentinelKey)) {
          setCategories(JSON.parse(JSON.stringify(defaultCategories)));
          if (!localStorage.getItem(catKey)) {
            localStorage.setItem(catKey, JSON.stringify(JSON.parse(JSON.stringify(defaultCategories))));
          }
          localStorage.setItem(sentinelKey, "true");
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const addSite = useCallback((name: string, url: string, categoryId: string, customIcon?: string) => {
    const prev = categoriesRef.current;
    const next = prev.map((c) => ({ ...c, websites: [...c.websites] }));
    const cat = next.find((c) => c.id === categoryId);
    if (!cat) return;
    const domain = getRootDomain(url);
    cat.websites.push({ id: generateSiteId(), name, url, domain, customIcon: customIcon || "" });
    setCategories(next);
    localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
    scheduleSync(next);
  }, [scheduleSync]);

  const editSite = useCallback((catIndex: number, siteIndex: number, updates: Partial<Website>) => {
    const prev = categoriesRef.current;
    const next = prev.map((c) => ({ ...c, websites: [...c.websites] }));
    Object.assign(next[catIndex].websites[siteIndex], updates);
    setCategories(next);
    localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
    scheduleSync(next);
  }, [scheduleSync]);

  const deleteSite = useCallback((catIndex: number, siteIndex: number) => {
    const prev = categoriesRef.current;
    const next = prev.map((c) => ({ ...c, websites: [...c.websites] }));
    next[catIndex].websites.splice(siteIndex, 1);
    setCategories(next);
    localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
    scheduleSync(next);
  }, [scheduleSync]);

  const moveSite = useCallback((fromCatIdx: number, fromSiteIdx: number, toCatIdx: number, toSiteIdx: number) => {
    const prev = categoriesRef.current;
    const next = prev.map((c) => ({ ...c, websites: [...c.websites] }));
    const [site] = next[fromCatIdx].websites.splice(fromSiteIdx, 1);
    const adjustedIdx = fromCatIdx === toCatIdx && fromSiteIdx < toSiteIdx ? toSiteIdx - 1 : toSiteIdx;
    next[toCatIdx].websites.splice(adjustedIdx, 0, site);
    setCategories(next);
    localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
    scheduleSync(next);
  }, [scheduleSync]);

  const addCategory = useCallback((name: string, icon: string) => {
    const prev = categoriesRef.current;
    const existingIds = new Set(prev.map((c) => c.id));
    const newCat: Category = { id: generateCategoryId(name, existingIds), name, icon: icon || "📁", websites: [] };
    const next = [...prev, newCat];
    setCategories(next);
    localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
    scheduleSync(next);
  }, [scheduleSync]);

  const editCategory = useCallback((catIndex: number, name: string, icon: string) => {
    const prev = categoriesRef.current;
    const next = [...prev];
    next[catIndex] = { ...next[catIndex], name, icon };
    setCategories(next);
    localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
    scheduleSync(next);
  }, [scheduleSync]);

  const deleteCategory = useCallback((catIndex: number) => {
    const prev = categoriesRef.current;
    const next = prev.filter((_, i) => i !== catIndex);
    setCategories(next);
    localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
    scheduleSync(next);
  }, [scheduleSync]);

  const reorderCategories = useCallback((fromIdx: number, toIdx: number) => {
    const prev = categoriesRef.current;
    const next = [...prev];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setCategories(next);
    localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
    scheduleSync(next);
  }, [scheduleSync]);

  const replaceAll = useCallback((newCats: Category[]) => {
    setCategories(newCats);
    localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(newCats));
    forceSync(newCats);
  }, [forceSync]);

  const importBookmarks = useCallback((
    bookmarks: ParsedBookmark[],
    opts?: { autoCreateCategories?: boolean; categoryOverrides?: Record<string, string>; autoImportHighConfidence?: boolean }
  ): { added: number; skipped: number; uncategorized: ParsedBookmark[]; createdCategories: string[]; pending: { bookmark: ParsedBookmark; classification: ClassificationResult }[] } => {
    const autoCreate = opts?.autoCreateCategories ?? false;
    const overrides = opts?.categoryOverrides ?? {};
    const highConfidenceOnly = opts?.autoImportHighConfidence ?? false;

    const currentCats = categoriesRef.current;

    const result = { added: 0, skipped: 0, uncategorized: [] as ParsedBookmark[], createdCategories: [] as string[], pending: [] as { bookmark: ParsedBookmark; classification: ClassificationResult }[] };
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

      // Check user override from preview dropdown
      const overrideCategoryId = overrides[normalUrl];
      if (overrideCategoryId) {
        const cat = next.find((c) => c.id === overrideCategoryId);
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
          continue;
        }
      }

      const classification = classifySite(bookmark.title, bookmark.url, next, bookmark.folder);

      // Staged import: only auto-import high-confidence matches
      if (highConfidenceOnly && classification.confidence !== "high") {
        result.pending.push({ bookmark, classification });
        continue;
      }

      let categoryId = classification.categoryId;
      if (!categoryId && autoCreate && classification.suggestedCategoryName) {
        const newId = generateCategoryId(classification.suggestedCategoryName, existingIds);
        const newCategory: Category = {
          id: newId,
          name: classification.suggestedCategoryName,
          icon: "📁",
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

    // When autoCreate is ON, handle remaining uncategorized bookmarks
    if (autoCreate && result.uncategorized.length > 0) {
      const existingIds = new Set(next.map((c) => c.id));
      const stillUncategorized: ParsedBookmark[] = [];

      // Pass 1: Group by browser folder name (catches any bookmarks with folders that
      // weren't matched by classifySite's folder-first pipeline)
      const folderMap = new Map<string, ParsedBookmark[]>();
      for (const b of result.uncategorized) {
        const key = b.folder || "";
        if (!folderMap.has(key)) folderMap.set(key, []);
        folderMap.get(key)!.push(b);
      }

      // Create a category for each folder group with ≥2 bookmarks
      for (const [folder, folderBookmarks] of folderMap) {
        if (!folder) {
          stillUncategorized.push(...folderBookmarks);
          continue;
        }
        if (folderBookmarks.length >= 2) {
          const sectionName = folder;
          const newId = generateCategoryId(sectionName, existingIds);
          existingIds.add(newId);
          const section: Category = {
            id: newId,
            name: sectionName,
            icon: "📁",
            websites: folderBookmarks.map((b) => ({
              id: generateSiteId(),
              name: b.title,
              url: b.url,
              domain: getRootDomain(b.url),
              customIcon: b.icon || "",
            })),
          };
          next.push(section);
          result.added += folderBookmarks.length;
          result.createdCategories.push(sectionName);
        } else {
          stillUncategorized.push(...folderBookmarks);
        }
      }

      // Pass 2: Group remaining folder-less bookmarks by root domain (≥3)
      const domainMap = new Map<string, ParsedBookmark[]>();
      for (const b of stillUncategorized) {
        const domain = getRootDomain(b.url);
        if (!domainMap.has(domain)) domainMap.set(domain, []);
        domainMap.get(domain)!.push(b);
      }

      const domainUncategorized: ParsedBookmark[] = [];
      for (const [domain, domainBookmarks] of domainMap) {
        if (domainBookmarks.length >= 3) {
          const sectionName = domain.charAt(0).toUpperCase() + domain.slice(1);
          const newId = generateCategoryId(sectionName, existingIds);
          existingIds.add(newId);
          const section: Category = {
            id: newId,
            name: sectionName,
            icon: "🌐",
            websites: domainBookmarks.map((b) => ({
              id: generateSiteId(),
              name: b.title,
              url: b.url,
              domain,
              customIcon: b.icon || "",
            })),
          };
          next.push(section);
          result.added += domainBookmarks.length;
          result.createdCategories.push(sectionName);
        } else {
          domainUncategorized.push(...domainBookmarks);
        }
      }

      // Pass 3: Anything left goes into an "Uncategorized" section
      if (domainUncategorized.length > 0) {
        const sectionName = "Uncategorized";
        const newId = generateCategoryId(sectionName, existingIds);
        const section: Category = {
          id: newId,
          name: sectionName,
          icon: "📂",
          websites: domainUncategorized.map((b) => ({
            id: generateSiteId(),
            name: b.title,
            url: b.url,
            domain: getRootDomain(b.url),
            customIcon: b.icon || "",
          })),
        };
        next.push(section);
        result.added += domainUncategorized.length;
        result.createdCategories.push(sectionName);
      }

      result.uncategorized = [];
    }

    setCategories(next);
    localStorage.setItem(foyerKey("categories", uidRef.current), JSON.stringify(next));
    forceSync(next);
    return result;
  }, [forceSync]);

  return (
    <CategoriesContext.Provider value={{
      categories, loading,
      addSite, editSite, deleteSite, moveSite,
      addCategory, editCategory, deleteCategory, reorderCategories,
      replaceAll,
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
