"use client";

import { useMediaPlayer } from "@/hooks/useMediaPlayer";

/**
 * Mini media player shown only when media is playing (or paused) in another
 * Chrome tab. Hidden entirely when there is no active media session or when
 * the Foyer extension is not installed.
 */
export default function MediaPlayer() {
  const { state, playPause, next, prev, focusTab } = useMediaPlayer();

  if (!state?.active || !state.title) return null;

  const controlsAvailable = !!state.controlsAvailable;
  const title = state.title || state.tabTitle;
  const subtitle = [state.artist, state.album].filter(Boolean).join(" — ");

  return (
    <div className="media-player" role="region" aria-label="Now playing">
      <button
        className="media-player-art"
        onClick={focusTab}
        title="Open in tab"
        aria-label="Open playing tab"
      >
        {state.artworkUrl ? (
          <img src={state.artworkUrl} alt="" loading="lazy" />
        ) : (
          <span className="media-player-art-fallback">
            <i className="fa-solid fa-music"></i>
          </span>
        )}
      </button>

      <button className="media-player-info" onClick={focusTab} title="Open in tab">
        <span className="media-player-title" title={title}>{title}</span>
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
          onClick={playPause}
          disabled={!controlsAvailable}
          title={state.playing ? "Pause" : "Play"}
          aria-label={state.playing ? "Pause" : "Play"}
        >
          <i className={`fa-solid ${state.playing ? "fa-pause" : "fa-play"}`}></i>
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
  );
}
