"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, collection as fsCollection, getDocs } from "firebase/firestore";
import { useFirestoreSync } from "@/hooks/useFirestoreSync";
import { defaultCategories } from "@/lib/defaults";
import { generateSiteId, generateCategoryId, getRootDomain } from "@/lib/utils";
import { foyerKey } from "@/lib/storage";
import type { Category, Website } from "@/lib/types";

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
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { scheduleSync, forceSync, initKnownIds } = useFirestoreSync();

  const prevUidRef = useRef<string | null>(null);
  const uidRef = useRef<string | null>(null);
  uidRef.current = user?.uid || null;

  // Client-only: restore from localStorage immediately on mount
  useEffect(() => {
    try {
      const uid = user?.uid;
      const key = foyerKey("categories", uid);
      const local = localStorage.getItem(key) || localStorage.getItem("categories");
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) parsed.forEach((c: any) => { if (!c.websites) c.websites = []; });
        setCategories(parsed);
        setLoading(false);
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync with Firestore on mount / auth change
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    if (prevUidRef.current !== null && prevUidRef.current !== uid) {
      setCategories([]);
      setLoading(true);
    }
    prevUidRef.current = uid;

    (async () => {
      try {
        const catsSnap = await getDocs(fsCollection(db, "users", uid, "categories"));
        const catKey = foyerKey("categories", uid);
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
          setCategories(loaded);
          localStorage.setItem(catKey, JSON.stringify(loaded));
          initKnownIds(loaded);
        } else {
          // First visit for this user — Firestore empty, use defaults
          const data: Category[] = JSON.parse(JSON.stringify(defaultCategories));
          data.forEach((c) => c.websites.forEach((s) => { if (!s.id) s.id = generateSiteId(); }));
          setCategories(data);
          localStorage.setItem(catKey, JSON.stringify(data));
          initKnownIds(data);
          await forceSync(data);
        }
      } catch (err) {
        console.error("Firestore load failed, falling back to localStorage:", err);
        const catKey = foyerKey("categories", uid);
        const local = localStorage.getItem(catKey) || localStorage.getItem("categories");
        if (local) {
          setCategories(JSON.parse(local));
        } else {
          setCategories(JSON.parse(JSON.stringify(defaultCategories)));
        }
      }
      setLoading(false);
    })();
  }, [user]);

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

  return (
    <CategoriesContext.Provider value={{
      categories, loading,
      addSite, editSite, deleteSite, moveSite,
      addCategory, editCategory, deleteCategory, reorderCategories,
      replaceAll, save,
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
