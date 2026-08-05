"use client";

import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { UNSPLASH_CONFIG } from "@/lib/constants";
import { foyerKey } from "@/lib/storage";
import type { UnsplashState } from "@/lib/types";

export interface WallpaperPhoto {
  id: string;
  previewUrl: string;
  highResUrl: string;
  photoUrl: string;
  photographerName: string;
  photographerUrl: string;
  width: number;
  height: number;
}

export interface UnsplashCollection {
  id: string;
  title: string;
  description?: string;
  totalPhotos: number;
  coverUrl: string;
}

const API_BASE = "https://api.unsplash.com";
const PHOTOS_PER_PAGE = 30;

function readConnection(uid: string | null): UnsplashState | null {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(foyerKey("unsplash_connection", uid));
    return raw ? (JSON.parse(raw) as UnsplashState) : null;
  } catch {
    return null;
  }
}

function mapPhoto(p: any): WallpaperPhoto {
  const optimalWidth = typeof window !== "undefined" && window.innerWidth <= 768 ? 1080 : 1920;
  const highResUrl = `${p.urls?.raw || ""}&auto=format&fit=crop&w=${optimalWidth}&q=75`;
  return {
    id: p.id,
    previewUrl: p.urls?.small || p.urls?.thumb || "",
    highResUrl,
    photoUrl: `${p.links?.html || "https://unsplash.com"}?utm_source=foyer&utm_medium=referral`,
    photographerName: p.user?.name || "Unknown",
    photographerUrl: `${p.user?.links?.html || "https://unsplash.com"}?utm_source=homepage&utm_medium=referral`,
    width: p.width || 1920,
    height: p.height || 1080,
  };
}

function mapCollection(c: any): UnsplashCollection {
  return {
    id: c.id,
    title: c.title || "Untitled",
    description: c.description || c.curated || "",
    totalPhotos: c.total_photos ?? 0,
    coverUrl: c.cover_photo?.urls?.small || c.cover_photo?.urls?.thumb || c.preview_photos?.[0]?.urls?.small || "",
  };
}

export function useWallpaperPicker() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [connected, setConnected] = useState(false);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const loadedConnRef = useRef(false);

  // Foyer favorites
  const [favorites, setFavorites] = useState<WallpaperPhoto[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);

  // Browse
  const [featured, setFeatured] = useState<UnsplashCollection[]>([]);
  const [searchResults, setSearchResults] = useState<UnsplashCollection[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [activeCollection, setActiveCollection] = useState<UnsplashCollection | null>(null);
  const [collectionPhotos, setCollectionPhotos] = useState<WallpaperPhoto[]>([]);

  const authHeaders = useCallback(() => {
    const headers: Record<string, string> = { Authorization: `Client-ID ${UNSPLASH_CONFIG.accessKey}` };
    const conn = readConnection(uid);
    if (conn?.accessToken) headers.Authorization = `Bearer ${conn.accessToken}`;
    return headers;
  }, [uid]);

  // Sync connection state from localStorage
  const refreshConnection = useCallback(() => {
    const conn = readConnection(uid);
    setConnected(!!conn?.accessToken);
    setCollectionId(conn?.foyerCollectionId || null);
  }, [uid]);

  // ── Foyer favorites ──────────────────────────────────────────────────────

  const loadFavorites = useCallback(async () => {
    const conn = readConnection(uid);
    const cid = conn?.foyerCollectionId || collectionId;
    if (!cid) return;
    setFavoritesLoading(true);
    setFavoritesError(null);
    try {
      const res = await fetch(
        `${API_BASE}/collections/${cid}/photos?per_page=${PHOTOS_PER_PAGE}&orientation=landscape`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error(`Unsplash API error: ${res.status}`);
      const data = await res.json();
      setFavorites(data.map(mapPhoto));
    } catch (err) {
      console.error("Failed to load Foyer collection:", err);
      setFavoritesError(err instanceof Error ? err.message : "Failed to load favorites");
    } finally {
      setFavoritesLoading(false);
    }
  }, [collectionId, authHeaders, uid]);

  // ── Browse: featured + search + collection photos ───────────────────────

  const loadFeatured = useCallback(async () => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const res = await fetch(
        `${API_BASE}/collections?featured=true&per_page=24`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error(`Unsplash API error: ${res.status}`);
      const data = await res.json();
      setFeatured(data.map(mapCollection));
    } catch (err) {
      console.error("Failed to load featured collections:", err);
      setBrowseError(err instanceof Error ? err.message : "Failed to load collections");
    } finally {
      setBrowseLoading(false);
    }
  }, [authHeaders]);

  const searchCollections = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) {
      setSearchQuery("");
      setSearchResults([]);
      return;
    }
    setSearchQuery(q);
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const res = await fetch(
        `${API_BASE}/search/collections?query=${encodeURIComponent(q)}&per_page=24`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error(`Unsplash API error: ${res.status}`);
      const data = await res.json();
      setSearchResults((data.results || []).map(mapCollection));
    } catch (err) {
      console.error("Failed to search collections:", err);
      setBrowseError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBrowseLoading(false);
    }
  }, [authHeaders]);

  const openCollection = useCallback(async (collection: UnsplashCollection) => {
    setActiveCollection(collection);
    setCollectionPhotos([]);
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const res = await fetch(
        `${API_BASE}/collections/${collection.id}/photos?per_page=${PHOTOS_PER_PAGE}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error(`Unsplash API error: ${res.status}`);
      const data = await res.json();
      setCollectionPhotos(data.map(mapPhoto));
    } catch (err) {
      console.error("Failed to load collection photos:", err);
      setBrowseError(err instanceof Error ? err.message : "Failed to load collection");
    } finally {
      setBrowseLoading(false);
    }
  }, [authHeaders]);

  const closeCollection = useCallback(() => {
    setActiveCollection(null);
    setCollectionPhotos([]);
  }, []);

  // One-time connection sync on mount (used when modal opens)
  const ensureLoaded = useCallback(() => {
    if (!loadedConnRef.current) {
      refreshConnection();
      loadedConnRef.current = true;
    }
  }, [refreshConnection]);

  return {
    connected,
    collectionId,
    refreshConnection,
    ensureLoaded,
    // Favorites
    favorites,
    favoritesLoading,
    favoritesError,
    loadFavorites,
    // Browse
    featured,
    searchResults,
    searchQuery,
    browseLoading,
    browseError,
    activeCollection,
    collectionPhotos,
    loadFeatured,
    searchCollections,
    openCollection,
    closeCollection,
  };
}
