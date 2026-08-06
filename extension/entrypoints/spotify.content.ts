import { defineContentScript } from "wxt/sandbox";
import { handlePageMediaControl } from "@/lib/domMediaControls";

/**
 * In-page detector + control bridge for the Spotify web player. Spotify's tab
 * never reports `audible` to chrome.tabs (Web Audio playback without a
 * recognized audio element), so the background cannot see it via tab events.
 * This script polls the page's Media Session data (Spotify web integrates
 * `navigator.mediaSession`) and reports snapshots to the background via
 * `SPOTIFY_STATE` messages. Runs in-page, so it survives background
 * service-worker idle.
 */

interface SpotifySnapshot {
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  playing: boolean;
}

function readSnapshot(): SpotifySnapshot {
  const ms = (navigator as any).mediaSession;
  const metadata = ms?.metadata as any;

  let title: string | undefined;
  let artist: string | undefined;
  let album: string | undefined;
  let artworkUrl: string | undefined;

  if (metadata && typeof metadata === "object") {
    title = metadata.title || undefined;
    artist = metadata.artist || undefined;
    album = metadata.album || undefined;
    const artwork = Array.isArray(metadata.artwork) ? metadata.artwork : [];
    for (const img of artwork) {
      if (img && typeof img.src === "string" && img.src.startsWith("http")) {
        artworkUrl = img.src;
        break;
      }
    }
  }

  const playing = ms?.playbackState === "playing";

  return { title, artist, album, artworkUrl, playing };
}

export default defineContentScript({
  matches: ["https://open.spotify.com/*"],
  runAt: "document_idle",
  main() {
    console.log("[foyer] spotify content script active");

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "PAGE_MEDIA_CONTROL") {
        sendResponse(handlePageMediaControl(message));
        return;
      }
      if (message?.type === "SPOTIFY_PING") {
        sendResponse({ state: readSnapshot() });
        return;
      }
    });

    let lastJson = "";
    let reportedIdle = false;

    const tick = () => {
      const snap = readSnapshot();
      const json = JSON.stringify(snap);

      const hasMedia = !!snap.title;
      if (json === lastJson && (hasMedia || reportedIdle)) return;

      lastJson = json;
      reportedIdle = !hasMedia && !snap.playing;

      chrome.runtime
        .sendMessage({ type: "SPOTIFY_STATE", state: snap })
        .catch(() => { /* extension reloaded or removed */ });
    };

    tick();
    setInterval(tick, 800);
  },
});