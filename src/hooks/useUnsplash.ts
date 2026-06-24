"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export function useUnsplash() {
  const { user } = useAuth();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY || "";

  // Restore Unsplash connection from localStorage (bypasses ad-blocker)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("unsplash_connection");
      if (stored) {
        const data = JSON.parse(stored);
        setAccessToken(data.accessToken);
        setCollectionId(data.foyerCollectionId ?? null);
        setUsername(data.username ?? null);
        setConnected(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Load Unsplash state from Firestore
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists() && snap.data().unsplash?.accessToken) {
          const data = snap.data().unsplash;
          setAccessToken(data.accessToken);
          setCollectionId(data.foyerCollectionId || null);
          setUsername(data.username || null);
          setConnected(true);
          localStorage.setItem("unsplash_connection", JSON.stringify(data));
        }
      } catch (e) {
        console.warn("Could not load Unsplash state:", e);
      }
    };
    load();
  }, [user]);

  // Start Unsplash OAuth
  const startOAuth = useCallback(() => {
    if (!clientId || clientId === "YOUR_UNSPLASH_CLIENT_ID") {
      alert("Unsplash is not configured yet.");
      return;
    }
    const redirectUri = `${window.location.origin}/unsplash-callback`;
    const scopes = encodeURIComponent("public write_likes write_collections");
    const url = `https://unsplash.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}`;
    window.location.href = url;
  }, [clientId]);

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
          await setDoc(doc(db, "users", user.uid), { unsplash: { foyerCollectionId: cid } }, { merge: true });
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
        imageLink?.classList.add("heart-liked");
        try {
          const liked = JSON.parse(localStorage.getItem("unsplash_liked_photos") || "[]");
          if (!liked.includes(photoId)) {
            liked.push(photoId);
            localStorage.setItem("unsplash_liked_photos", JSON.stringify(liked));
          }
        } catch { /* ignore */ }
        showToast("Added to your Foyer collection on Unsplash \uD83D\uDC9B");
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
  }, [accessToken, collectionId, user]);

  // Wire up heart button and unsplash popup
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

  return { connected, username, loading, startOAuth };
}

// Inline toast for now (avoids circular deps)
function showToast(message: string, type: "success" | "error" = "success") {
  const toast = document.getElementById("foyerToast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `foyer-toast foyer-toast--${type} show`;
  setTimeout(() => toast.classList.remove("show"), 3000);
}
