/**
 * Defensive wrapper around the `chrome.mediaController` API (Chrome 132+).
 * Every call is feature-detected and failure-tolerant so the feature
 * degrades gracefully (title/favicon + disabled controls) on older browsers.
 */

export interface MediaSessionInfo {
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  canNext?: boolean;
  canPrev?: boolean;
  /** The tab this session belongs to, when Chrome exposes it (getState). */
  tabId?: number;
  /** Playback state from the session (more accurate than tab.audible). */
  playing?: boolean;
}

export type MediaControllerAction =
  | "playOrPause"
  | "nextTrack"
  | "previousTrack"
  | "stop";

function controller(): any | undefined {
  try {
    return (chrome as any).mediaController;
  } catch {
    return undefined;
  }
}

export function hasMediaController(): boolean {
  return !!controller();
}

/** Extract title/artist/album/artwork defensively from an unknown payload shape. */
function extractMetadata(payload: any): MediaSessionInfo | null {
  if (!payload) return null;
  const m = payload.metadata || payload;
  if (typeof m !== "object") return null;
  const artwork = Array.isArray(m.artwork)
    ? m.artwork[0]?.src || m.artwork[0]?.url
    : typeof m.artwork === "string"
      ? m.artwork
      : undefined;
  return {
    title: m.title || m.songTitle || undefined,
    artist: m.artist || m.albumArtist || undefined,
    album: m.album || undefined,
    artworkUrl: artwork || undefined,
    tabId: typeof payload.tabId === "number" ? payload.tabId : undefined,
    playing:
      payload.playbackState === "playing"
        ? true
        : payload.playbackState === "paused"
          ? false
          : undefined,
  };
}

function extractKeys(payload: any): string[] | null {
  if (!payload) return null;
  const keys = Array.isArray(payload) ? payload : payload.supportedKeys || payload.keys;
  return Array.isArray(keys) ? keys.map(String) : null;
}

/**
 * Register listeners that fire `onChange` whenever the active media session
 * changes (metadata, playback state, supported keys). Returns an unsubscribe fn.
 */
export function registerMediaControllerEvents(onChange: () => void): () => void {
  const mc = controller();
  if (!mc) return () => {};
  const unsubs: Array<() => void> = [];
  const listen = (event: any) => {
    if (event?.addListener) {
      event.addListener(onChange);
      unsubs.push(() => {
        try { event.removeListener(onChange); } catch { /* ignore */ }
      });
    }
  };
  try {
    listen(mc.onMetadataChanged);
    listen(mc.onPlaybackStateChanged);
    listen(mc.onSupportedKeysChanged);
  } catch { /* ignore */ }
  return () => unsubs.forEach((fn) => fn());
}

/**
 * Poll the current media session for a metadata snapshot. Falls back to null
 * when the API is absent or the session has no metadata.
 */
export async function getMediaSessionInfo(): Promise<MediaSessionInfo | null> {
  const mc = controller();
  if (!mc) return null;
  try {
    let info: MediaSessionInfo | null = null;
    if (typeof mc.getState === "function") {
      info = extractMetadata(await mc.getState());
    } else if (typeof mc.getMetadata === "function") {
      info = extractMetadata(await mc.getMetadata());
    }
    return info;
  } catch {
    return null;
  }
}

/** Send a control command to the active media session. Returns true when the
 * command was dispatched. No-op (false) when unsupported or errored. */
export async function sendMediaAction(action: MediaControllerAction): Promise<boolean> {
  const mc = controller();
  if (!mc || typeof mc[action] !== "function") return false;
  try {
    await mc[action]();
    return true;
  } catch {
    return false;
  }
}
