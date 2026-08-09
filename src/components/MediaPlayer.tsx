"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaPlayer } from "@/hooks/useMediaPlayer";

/**
 * Mini media player shown only when media is playing (or paused) in another
 * Chrome tab. Hidden entirely when there is no active media session or when
 * the Foyer extension is not installed.
 */
export default function MediaPlayer() {
  const { state, playPause, next, prev, focusTab } = useMediaPlayer();

  const titleRef = useRef<HTMLSpanElement>(null);
  const [marquee, setMarquee] = useState(false);

  // Optimistic play/pause: flip the icon immediately on click, reconcile when
  // the next real state arrives (or give up after a timeout).
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(null);
  const playing = optimisticPlaying ?? !!state?.playing;

  useEffect(() => {
    setOptimisticPlaying(null);
  }, [state?.playing, state?.title]);

  useEffect(() => {
    if (optimisticPlaying === null) return;
    const t = setTimeout(() => setOptimisticPlaying(null), 1500);
    return () => clearTimeout(t);
  }, [optimisticPlaying]);

  const checkOverflow = useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    setMarquee(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [checkOverflow, state?.title]);

  if (!state?.active || !state.title) return null;

  const controlsAvailable = !!state.controlsAvailable;
  const title = state.title || state.tabTitle;
  const subtitle = [state.artist, state.album].filter(Boolean).join(" — ");

  const onPlayPause = () => {
    if (optimisticPlaying !== null) return; // wait for reconciliation
    setOptimisticPlaying(!playing);
    playPause();
  };

  return (
    <div className="media-player" role="region" aria-label="Now playing">
      <div className="media-player-sheen" aria-hidden="true"></div>
      <div className="media-player-surface">
        <button
          className="media-player-art"
          onClick={focusTab}
          title="Open in tab"
          aria-label="Open playing tab"
        >
          {state.artworkUrl ? (
            <img src={state.artworkUrl} alt="" className="media-player-art-img" loading="lazy" />
          ) : state.favIconUrl ? (
            <img src={state.favIconUrl} alt="" className="media-player-art-favicon" loading="lazy" />
          ) : (
            <span className="media-player-art-fallback">
              <i className="fa-solid fa-music"></i>
            </span>
          )}
        </button>

        <button className="media-player-info" onClick={focusTab} title="Open in tab">
          <span
            ref={titleRef}
            className={`media-player-title${marquee ? " marquee" : ""}`}
            title={marquee ? undefined : title}
          >
            {marquee ? (
              <span className="media-player-title-track">{title}{title}</span>
            ) : (
              title
            )}
          </span>
          {subtitle && <span className="media-player-subtitle" title={subtitle}>{subtitle}</span>}
        </button>

        <div className="media-player-controls">
          <button
            className="media-player-btn"
            onClick={prev}
            disabled={!controlsAvailable || !state.canPrev}
            title="Previous track"
            aria-label="Previous track"
          >
            <i className="fa-solid fa-backward-step"></i>
          </button>
          <button
            className="media-player-btn media-player-play"
            onClick={onPlayPause}
            disabled={!controlsAvailable}
            title={playing ? "Pause" : "Play"}
            aria-label={playing ? "Pause" : "Play"}
          >
            <i className={`fa-solid ${playing ? "fa-pause" : "fa-play"}`}></i>
          </button>
          <button
            className="media-player-btn"
            onClick={next}
            disabled={!controlsAvailable || !state.canNext}
            title="Next track"
            aria-label="Next track"
          >
            <i className="fa-solid fa-forward-step"></i>
          </button>
        </div>

        <div className="media-player-source" title={state.tabTitle}>
          {state.favIconUrl ? (
            <img src={state.favIconUrl} alt="" className="media-player-favicon" loading="lazy" />
          ) : (
            <i className="fa-solid fa-globe"></i>
          )}
          <span>{state.sourceDomain || "Chrome tab"}</span>
        </div>
      </div>
    </div>
  );
}