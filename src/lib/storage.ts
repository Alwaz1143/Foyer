export function foyerKey(key: string, uid?: string | null): string {
  return uid ? `foyer_${uid}_${key}` : `foyer_${key}`;
}

/** Keys a guest can create while browsing unauthenticated. */
const GUEST_MIGRATABLE_KEYS = [
  "categories",
  "weather_location",
  "wallpaperEnabled",
  "customWallpaperKeywords",
  "lastWallpaperKeyword",
  "widget_clock",
  "widget_calendar",
  "widget_weather",
  "widget_news",
  "widget_search",
  "unsplash_liked_photos",
];

/**
 * One-time data carry-over: copies anonymous `foyer_*` keys (created while
 * browsing as a guest) into the user's uid-scoped keys after sign-in. Each key
 * is copied only when the user has no existing value for it, so real account
 * data is never overwritten — which also makes repeated calls safe.
 */
export function migrateGuestData(uid: string): void {
  for (const key of GUEST_MIGRATABLE_KEYS) {
    const guest = localStorage.getItem(`foyer_${key}`);
    if (guest === null) continue;
    const target = foyerKey(key, uid);
    if (localStorage.getItem(target) !== null) continue;
    localStorage.setItem(target, guest);
  }
}
