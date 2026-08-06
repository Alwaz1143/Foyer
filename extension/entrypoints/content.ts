import { defineContentScript } from "wxt/sandbox";

const MEDIA_STATE_KEY = "foyer_media_state";

/**
 * Bridge between the extension background and the Foyer page:
 * - relays media state (chrome.storage.local) to the page via `foyer:media`
 * - forwards page control requests back to the background via messages
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    // Only bridge on Foyer pages — everywhere else this is a no-op
    const host = window.location.hostname.replace(/^www\./, "");
    if (!["localhost", "127.0.0.1", "foyer.alwaz.tech"].includes(host)) return;

    const notify = (state: unknown) => {
      window.dispatchEvent(new CustomEvent("foyer:media", { detail: state }));
    };

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[MEDIA_STATE_KEY]) {
        notify(changes[MEDIA_STATE_KEY].newValue);
      }
    });

    // Initial handshake: fetch current state (worker may have restarted)
    chrome.runtime
      .sendMessage({ type: "GET_MEDIA_STATE" })
      .then((res: any) => {
        if (res?.state) notify(res.state);
      })
      .catch(() => { /* extension removed or not ready */ });

    // Page → background controls
    window.addEventListener("foyer:media-action", ((e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action) {
        chrome.runtime
          .sendMessage({ type: "MEDIA_ACTION", action: detail.action })
          .catch(() => { /* ignore */ });
      }
    }) as EventListener);
  },
});
