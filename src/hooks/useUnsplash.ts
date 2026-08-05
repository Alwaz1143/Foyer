"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

import { foyerKey } from "@/lib/storage";
import { showToast } from "@/lib/toast";

export function useUnsplash() {
  const { user } = useAuth();
  const uidRef = useRef<string | null>(null);
  uidRef.current = user?.uid ?? null;

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY || "";

  // Restore Unsplash connection from localStorage (scoped per-user, bypasses ad-blocker)
  useEffect(() => {
    const uid = user?.uid;
    // Clear state first so previous user's connection isn't shown
    setAccessToken(null);
    setCollectionId(null);
    setUsername(null);
    setConnected(false);
    try {
      const stored =
        localStorage.getItem(foyerKey("unsplash_connection", uid)) ||
        (!uid ? localStorage.getItem("unsplash_connection") : null);
      if (stored) {
        const data = JSON.parse(stored);
        setAccessToken(data.accessToken);
        setCollectionId(data.foyerCollectionId ?? null);
        setUsername(data.username ?? null);
        setConnected(true);
      }
    } catch { /* ignore */ }
  }, [user]); // re-run on every user change



  /**
   * Recomputes and applies the heart button color based on:
   * - whether the user is connected to Unsplash
   * - whether the current photo is in the user's liked list
   * Always call this after: photo change, connected change, user change, successful add.
   */
  const refreshHeart = useCallback(() => {
    const ilink = document.getElementById("imageLink");
    if (!ilink) return;
    const photoId = (window as any).currentUnsplashPhotoId as string | undefined;

    // Always reset to default (white) first
    ilink.classList.remove("heart-liked");

    // Not connected → always white, CSS hover handles the red-on-hover only
    if (!connected || !photoId) return;

    // Connected → check if this photo is in the liked list
    try {
      const uid = uidRef.current;
      const liked: string[] = JSON.parse(
        localStorage.getItem(foyerKey("unsplash_liked_photos", uid)) ||
        localStorage.getItem("unsplash_liked_photos") ||
        "[]"
      );
      if (liked.includes(photoId)) ilink.classList.add("heart-liked");
    } catch { /* ignore */ }
  }, [connected]);

  // Re-evaluate heart state after every render (React may clear classList on re-render)
  useEffect(() => {
    refreshHeart();
  });

  // Re-evaluate heart whenever a new photo is applied (fired by useWallpaper.applyPhoto)
  useEffect(() => {
    const handler = () => refreshHeart();
    window.addEventListener("foyer:photochange", handler);
    return () => window.removeEventListener("foyer:photochange", handler);
  }, [refreshHeart]);

  // Start Unsplash OAuth
  const startOAuth = useCallback(() => {
    if (!clientId || clientId === "YOUR_UNSPLASH_CLIENT_ID") {
      showToast("Unsplash is not configured yet.", "error");
      return;
    }
    const redirectUri = `${window.location.origin}/unsplash-callback`;
    const scopes = encodeURIComponent("public write_likes write_collections");
    const url = `https://unsplash.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}`;
    window.location.href = url;
  }, [clientId]);

  // Add a photo id to the local liked mirror (keeps the heart red on any path)
  const markAsLiked = useCallback((photoId: string) => {
    if (!photoId) return;
    try {
      const uid = uidRef.current;
      const likedKey = foyerKey("unsplash_liked_photos", uid);
      const liked: string[] = JSON.parse(
        localStorage.getItem(likedKey) ||
        localStorage.getItem("unsplash_liked_photos") ||
        "[]"
      );
      if (!liked.includes(photoId)) {
        liked.push(photoId);
        localStorage.setItem(likedKey, JSON.stringify(liked));
      }
    } catch { /* ignore */ }
    refreshHeart();
  }, [refreshHeart]);

  // Add current photo to Unsplash collection
  const addToCollection = useCallback(async (photoId: string | null) => {
    if (!accessToken || !photoId) return false;

    const imageLink = document.getElementById("imageLink");
    imageLink?.classList.add("heart-loading");

    try {
      let cid = collectionId;
      if (!cid) {
        const res = await fetch("https://api.unsplash.com/collections", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "Foyer",
            description: "Photos I loved while using Foyer — my personal browser homepage",
            private: false,
          }),
        });
        if (!res.ok) throw new Error(`Create collection failed: ${res.status}`);
        const col = await res.json();
        cid = col.id;
        setCollectionId(cid);
        if (user) {
          const key = foyerKey("unsplash_connection", user.uid);
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const data = JSON.parse(stored);
              data.foyerCollectionId = cid;
              localStorage.setItem(key, JSON.stringify(data));
            } catch { /* ignore */ }
          }
        }
      }

      const res = await fetch(`https://api.unsplash.com/collections/${cid}/add`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ photo_id: photoId }),
      });

      if (res.ok || res.status === 422) {
        // Save to liked list (keeps heart red on future loads too)
        markAsLiked(photoId);
        showToast("Added to your Foyer collection on Unsplash 💛");
        return true;
      }
      throw new Error(`API error ${res.status}`);
    } catch (err) {
      console.error("Failed to add to Unsplash collection:", err);
      showToast("Failed to add to collection", "error");
      return false;
    } finally {
      imageLink?.classList.remove("heart-loading");
    }
  }, [accessToken, collectionId, user, markAsLiked]);

  // Wire up heart button click and unsplash popup
  useEffect(() => {
    const imageLink = document.getElementById("imageLink");
    const popup = document.getElementById("unsplashPopup");
    const connectBtn = document.getElementById("connectUnsplashPopupBtn");
    const openBtn = document.getElementById("openInUnsplashBtn") as HTMLAnchorElement | null;

    if (!imageLink) return;

    const handleHeartClick = (e: Event) => {
      e.preventDefault();
      const currentPhotoId = (window as any).currentUnsplashPhotoId;
      if (connected && currentPhotoId) {
        addToCollection(currentPhotoId);
      } else if (currentPhotoId) {
        popup?.classList.toggle("show");
        if (openBtn) openBtn.href = (window as any).currentUnsplashPhotoUrl || imageLink.getAttribute("href") || "#";
      }
    };

    imageLink.addEventListener("click", handleHeartClick);

    const closePopup = (e: MouseEvent) => {
      if (popup && !imageLink.contains(e.target as Node) && !popup.contains(e.target as Node)) {
        popup?.classList.remove("show");
      }
    };
    document.addEventListener("click", closePopup);

    if (connectBtn) {
      connectBtn.addEventListener("click", () => {
        popup?.classList.remove("show");
        startOAuth();
      });
    }

    return () => {
      imageLink.removeEventListener("click", handleHeartClick);
      document.removeEventListener("click", closePopup);
    };
  }, [connected, addToCollection, startOAuth]);

  return { connected, username, loading, startOAuth, markAsLiked };
}
