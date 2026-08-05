"use client";

import { useState, useEffect, useCallback } from "react";

export interface MediaPlayerState {
  active: boolean;
  tabId?: number;
  tabTitle?: string;
  favIconUrl?: string;
  sourceUrl?: string;
  sourceDomain?: string;
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  playing?: boolean;
  canNext?: boolean;
  canPrev?: boolean;
  controlsAvailable?: boolean;
}

export type MediaPlayerAction = "playOrPause" | "nextTrack" | "previousTrack" | "focusTab";

/**
 * Tracks media playing in any Chrome tab (relayed from the Foyer extension).
 * Stays `null` when the extension is absent, so the mini player simply hides.
 */
export function useMediaPlayer() {
  const [state, setState] = useState<MediaPlayerState | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.active === "boolean") {
        setState(detail as MediaPlayerState);
      }
    };
    window.addEventListener("foyer:media", handler);
    return () => window.removeEventListener("foyer:media", handler);
  }, []);

  const sendAction = useCallback((action: MediaPlayerAction) => {
    window.dispatchEvent(new CustomEvent("foyer:media-action", { detail: { action } }));
  }, []);

  const playPause = useCallback(() => sendAction("playOrPause"), [sendAction]);
  const next = useCallback(() => sendAction("nextTrack"), [sendAction]);
  const prev = useCallback(() => sendAction("previousTrack"), [sendAction]);
  const focusTab = useCallback(() => sendAction("focusTab"), [sendAction]);

  return { state, playPause, next, prev, focusTab };
}
