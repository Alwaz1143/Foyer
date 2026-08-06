import { defineContentScript } from "wxt/sandbox";
import { handlePageMediaControl } from "@/lib/domMediaControls";

/**
 * Control bridge for YouTube / YouTube Music. Detection stays with the
 * background's audible-tab tracker; this script only makes the mini player's
 * buttons click the real player controls instantly (instead of the slow
 * `chrome.mediaController` system path).
 */
export default defineContentScript({
  matches: ["https://www.youtube.com/*", "https://music.youtube.com/*"],
  runAt: "document_idle",
  main() {
    if ((window as any).__foyerYouTubeLoaded) return;
    (window as any).__foyerYouTubeLoaded = true;
    console.log("[foyer] youtube content script active");

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "PAGE_MEDIA_CONTROL") {
        const res = handlePageMediaControl(message);
        console.log("[foyer] PAGE_MEDIA_CONTROL", message.action, "->", res);
        sendResponse(res);
      }
    });
  },
});
