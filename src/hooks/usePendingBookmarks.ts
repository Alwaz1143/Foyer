"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/contexts/CategoriesContext";
import {
  subscribePendingBookmarks,
  removePendingBookmark,
  addPendingBookmark as addPendingLib,
} from "@/lib/pendingBookmarks";
import type { PendingBookmark } from "@/lib/types";
import type { ClassificationResult } from "@/lib/classifySite";

export function usePendingBookmarks() {
  const { user } = useAuth();
  const { addSite } = useCategories();
  const uid = user?.uid;

  const [pendingBookmarks, setPendingBookmarks] = useState<PendingBookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPendingBookmarks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribePendingBookmarks(uid, (items) => {
      setPendingBookmarks(items);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const pendingCount = pendingBookmarks.length;

  const confirmOne = useCallback(async (id: string, categoryId: string) => {
    if (!uid) return;
    const item = pendingBookmarks.find((p) => p.id === id);
    if (!item) return;
    await addSite(item.title, item.url, categoryId, item.icon);
    await removePendingBookmark(uid, id);
  }, [uid, pendingBookmarks, addSite]);

  const skipOne = useCallback(async (id: string) => {
    if (!uid) return;
    await removePendingBookmark(uid, id);
  }, [uid]);

  const confirmAll = useCallback(async (categoryId?: string) => {
    if (!uid) return;
    for (const item of pendingBookmarks) {
      if (categoryId) {
        await addSite(item.title, item.url, categoryId, item.icon);
      }
      await removePendingBookmark(uid, item.id);
    }
  }, [uid, pendingBookmarks, addSite]);

  const skipAll = useCallback(async () => {
    if (!uid) return;
    for (const item of pendingBookmarks) {
      await removePendingBookmark(uid, item.id);
    }
  }, [uid, pendingBookmarks]);

  return {
    pendingBookmarks,
    pendingCount,
    loading,
    confirmOne,
    skipOne,
    confirmAll,
    skipAll,
  };
}

export { addPendingLib as addPendingBookmark };
