/**
 * In-page media controls for sites whose players can't be (or are slowly)
 * controlled via `chrome.mediaController`. Content scripts on the matched
 * sites click the player's real DOM buttons on behalf of the Foyer mini
 * player. Each site keeps a selector map; unknown sites fail gracefully.
 */

export type DomMediaAction = "playOrPause" | "nextTrack" | "previousTrack";

interface DomainControls {
  playPause: string;
  next: string;
  previous: string;
}

const DOMAIN_MAP: Record<string, DomainControls> = {
  "spotify.com": {
    playPause: '[data-testid="control-button-playpause"]',
    next: '[data-testid="control-button-skip-forward"]',
    previous: '[data-testid="control-button-skip-back"]',
  },
  "youtube.com": {
    playPause: ".ytp-play-button",
    next: ".ytp-next-button",
    previous: ".ytp-prev-button",
  },
  "music.youtube.com": {
    playPause: "#play-pause-button",
    next: "#next-button",
    previous: "#previous-button",
  },
};

function controlsForHost(): DomainControls | null {
  try {
    return DOMAIN_MAP[window.location.hostname.replace(/^www\./, "")] || null;
  } catch {
    return null;
  }
}

function clickOnce(selector: string): boolean {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return false;
  el.click();
  return true;
}

/**
 * Handle a `PAGE_MEDIA_CONTROL` message from the background. Returns
 * `{ clicked: boolean }`; `clicked` is false when the site has no mapped
 * controls or the button element is missing.
 */
export function handlePageMediaControl(message: { action?: string }): { clicked: boolean } {
  const controls = controlsForHost();
  if (!controls) return { clicked: false };
  switch (message.action) {
    case "playOrPause":
      return { clicked: clickOnce(controls.playPause) };
    case "nextTrack":
      return { clicked: clickOnce(controls.next) };
    case "previousTrack":
      return { clicked: clickOnce(controls.previous) };
    default:
      return { clicked: false };
  }
}
