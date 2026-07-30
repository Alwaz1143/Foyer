# Audit Remediation Plan

> Tier-by-tier plan for addressing security, bug, and polish issues discovered in the full audit.
> Each item has a status that will be updated as implementation progresses.

---

## Table of Contents

1. [Priority & Effort Matrix](#1-priority--effort-matrix)
2. [Tier 0: Critical Security](#2-tier-0-critical-security)
3. [Tier 1: Critical Bugs](#3-tier-1-critical-bugs)
4. [Tier 2: High Impact](#4-tier-2-high-impact)
5. [Tier 3: Polish](#5-tier-3-polish)

---

## 1. Priority & Effort Matrix

| # | Task | Tier | Effort | Dependencies |
|---|------|------|--------|-------------|
| 1 | Firestore security rules | 0 | Small | None |
| 2 | Extension Firebase API key → env vars | 0 | Tiny | None |
| 3 | Remove `window.auth` / `window.db` global exposure | 0 | Tiny | None |
| 4 | Unsplash token: stop storing in Firestore | 0 | Small | None |
| 5 | Fix side effects inside `setCategories` updater | 1 | Medium | None |
| 6 | Fix subdomain lookups in domain map | 1 | Small | None |
| 7 | Sync extension classifySite priority order | 1 | Small | None |
| 8 | Add React Error Boundary | 1 | Small | None |
| 9 | Fix sendResponse in extension async error paths | 1 | Small | None |
| 10 | Persist extension bookmark queue to chrome.storage.local | 1 | Small | None |
| 11 | Add error state + retry to all data hooks | 2 | Medium | None |
| 12 | Add cancelled guard before localStorage.setItem | 2 | Tiny | None |
| 13 | Use normalizeUrl() consistently | 2 | Tiny | None |
| 14 | Add onError handler to onSnapshot | 2 | Tiny | None |
| 15 | Add toast queue | 2 | Small | None |
| 16 | Refresh categories in extension popup during pending flow | 2 | Tiny | None |
| 17 | Enable Firestore IndexedDB persistence | 2 | Tiny | None |
| 18 | Add ShortcutGrid empty state | 3 | Small | None |
| 19 | Add offline/error widget CSS | 3 | Small | None |
| 20 | Add widget retry UI | 3 | Medium | #11, #19 |

---

## 2. Tier 0: Critical Security

### #1 — Firestore Security Rules

**Status:** ✅ Done

**Description:** No `firestore.rules` exists. Any authenticated user can read/write any document. Create rules that:
- Enforce `request.auth.uid == userId` on all path segments (`/users/{userId}/...`)
- Validate field types for settings, categories, widgets, and pendingBookmarks
- Deny all other paths

**Files:**
- New `firestore.rules` in project root

**Acceptance:** `firebase deploy --only firestore:rules` passes; read/write from wrong UID returns PERMISSION_DENIED.

---

### #2 — Extension Firebase API Key → Env Vars

**Status:** ✅ Done

**Description:** `extension/lib/firebase.ts` has hardcoded `apiKey`, `authDomain`, etc. WXT supports `import.meta.env.VITE_*` variables. Move config to a `.env` file (gitignored) and reference via `import.meta.env`.

**Files:**
- `extension/lib/firebase.ts`
- New `extension/.env` (gitignored)
- `extension/.env.example` (committed, placeholder values)

**Acceptance:** Extension builds and runs with no hardcoded secrets in source.

---

### #3 — Remove `window.auth` / `window.db` Global Exposure

**Status:** ✅ Done

**Description:** `AuthGuard.tsx:9-13` assigns Firebase instances to `window` at import time. Any third-party script can access Firestore through them. Remove assignments and refactor any consumers to import directly from `@/lib/firebase`.

**Files:**
- `src/components/AuthGuard.tsx`

**Acceptance:** No `window.auth` or `window.db` assignments exist in the codebase.

---

### #4 — Unsplash Token: Stop Storing in Firestore

**Status:** ✅ Done

**Description:** `unsplash-callback/page.tsx:58-69` writes the Unsplash `accessToken` to `users/{uid}/unsplash.accessToken` in Firestore. Tokens should never be stored in a shared database. Store only in `localStorage`. Use the client-side token directly for Unsplash API calls from the browser.

**Files:**
- `src/app/unsplash-callback/page.tsx`
- `src/hooks/useWallpaper.ts` (may need to read token from localStorage instead of Firestore)

**Acceptance:** Unsplash token is never written to Firestore. It exists only in `localStorage` on the user's machine.

---

## 3. Tier 1: Critical Bugs

### #5 — Fix Side Effects Inside `setCategories` Updater

**Status:** ❌ Not started

**Description:** Every mutation callback (`addSite`, `editSite`, `deleteSite`, `moveSite`, `addCategory`, `editCategory`, `deleteCategory`, `reorderCategories`) calls `localStorage.setItem()` + `scheduleSync()` **inside** the `setCategories((prev) => { ... })` functional updater. React 18+ strict mode may invoke the updater twice, causing duplicate writes.

Fix: Use a `ref` to capture the current categories array, compute the next state, then call `localStorage.setItem` + `scheduleSync` *outside* the updater.

**Files:**
- `src/contexts/CategoriesContext.tsx` (functions at lines 210-294)

**Acceptance:** No side effects (localStorage, scheduleSync, forceSync) inside any `setCategories` updater function. All mutations follow: `ref.current = computeNext(prev); setCategories(next); localStorage.setItem(...); scheduleSync(next);`

---

### #6 — Fix Subdomain Lookups in Domain Map

**Status:** ❌ Not started

**Description:** `classifySite.ts` uses `getRootDomain(url)` which strips subdomains (e.g., `"mail.google.com"` → `"google.com"`). The domain map has ~28 subdomain entries (`mail.google.com`, `docs.google.com`, etc.) that never match. Fix: check the full hostname first, then fall back to root domain.

**Files:**
- `src/lib/classifySite.ts`
- `extension/shared/classifySite.ts`

**Acceptance:** `classifySite("https://mail.google.com/...")` matches `mail.google.com` in the domain map. Both copies of classifySite implement the fix.

---

### #7 — Sync Extension classifySite Priority Order

**Status:** ❌ Not started

**Description:** Main app `classifySite.ts` order: folder → domain → keyword. Extension `classifySite.ts` order: domain → folder → keyword. This produces different classification results for the same URL between the two codebases. Make both match (folder-first is the correct order per the design).

**Files:**
- `extension/shared/classifySite.ts`

**Acceptance:** Both classifySite files use the same priority order: folder hint → domain map → keyword fallback.

---

### #8 — Add React Error Boundary

**Status:** ❌ Not started

**Description:** No error boundary exists anywhere in the app. A rendering crash in any component propagates uncaught. Create a reusable `ErrorBoundary` component and wrap the `<AuthGuard>` children in `layout.tsx`.

**Files:**
- New `src/components/ErrorBoundary.tsx`
- `src/app/layout.tsx`

**Acceptance:** A rendering error in any child component shows a fallback UI (not a white screen + console error). Error is logged.

---

### #9 — Fix sendResponse in Extension Async Error Paths

**Status:** ❌ Not started

**Description:** Six async message handlers in `background.ts` have `.catch()` blocks that only `console.error` and never call `sendResponse`. Chrome keeps the sender's port open for ~5 minutes waiting for a response. Every catch must call `sendResponse({ success: false, error: err.message })`.

**Files:**
- `extension/entrypoints/background.ts` (handlers at lines ~308, ~318, ~343, ~391, ~401, ~411)

**Acceptance:** Every async message handler's `.catch()` calls `sendResponse`. No open ports leak on handler failure.

---

### #10 — Persist Extension Bookmark Queue to chrome.storage.local

**Status:** ❌ Not started

**Description:** The `bookmarkQueue` in `background.ts:24` is a plain in-memory array. When the service worker is killed (idle timeout, crash, or Chrome update), queued bookmarks are lost forever. Persist the queue to `chrome.storage.local` on every mutation and re-hydrate on worker restart.

**Files:**
- `extension/entrypoints/background.ts`

**Acceptance:** After restarting the service worker (`chrome://inspect/#service-workers` → terminate), queued bookmarks are still present and processed on the next chrome.bookmarks.onCreated event.

---

## 4. Tier 2: High Impact

### #11 — Add Error State + Retry to All Data Hooks

**Status:** ❌ Not started

**Description:** Four data hooks silently swallow errors:

| Hook | Silent catch | console.error | Error state exposed |
|------|--------------|---------------|---------------------|
| `useWeather` | Line 100 | No | No |
| `useNews` | Line 54 | No | No |
| `useWallpaper` | Line 92 | Yes (line 122) | No |
| `useLocation` | Lines 33, 91 | No | No |

Each hook should return an `error` field (string | null) and a `retry()` function. Add `console.error` in every catch block. When `error` is non-null, widgets can render a retry UI.

**Files:**
- `src/hooks/useWeather.ts`
- `src/hooks/useNews.ts`
- `src/hooks/useWallpaper.ts`
- `src/hooks/useLocation.ts`

**Acceptance:** Each hook returns `{ ..., error, retry }`. Errors are logged. Widgets can distinguish "loading" from "failed with error message".

---

### #12 — Add Cancelled Guard Before localStorage.setItem

**Status:** ❌ Not started

**Description:** `CategoriesContext.tsx:149-150` sets `setCategories(deduped)` and `localStorage.setItem(...)` with no `if (cancelled) return;` guard. The last cancellation check was at line 120, well before the blocking `.map()` operations. If the component unmounts during this window, a stale write occurs.

**Files:**
- `src/contexts/CategoriesContext.tsx:149-150`

**Acceptance:** `if (cancelled) return;` is present immediately before line 149.

---

### #13 — Use normalizeUrl() Consistently

**Status:** ❌ Not started

**Description:** Line 138 uses `site.url.trim().toLowerCase()` for dedup while lines 320, 325 use `normalizeUrl()`. `normalizeUrl()` strips `www.`, trailing slashes, and protocol variations. Use it everywhere for consistent dedup behavior.

**Files:**
- `src/contexts/CategoriesContext.tsx:138`

**Acceptance:** All URL normalization in `CategoriesContext.tsx` uses `normalizeUrl()`.

---

### #14 — Add onError Handler to onSnapshot

**Status:** ❌ Not started

**Description:** `pendingBookmarks.ts:65` calls `onSnapshot(q, callback)` with only 2 arguments. If the listener encounters a permissions or network error, it silently tears down. Add a third `onError` callback that `console.error`s the error and calls an optional error callback.

**Files:**
- `src/lib/pendingBookmarks.ts`

**Acceptance:** `onSnapshot(q, onNext, onError)` is called. Errors are logged. An `onError` callback is passed through from the consumer.

---

### #15 — Add Toast Queue

**Status:** ❌ Not started

**Description:** `toast.ts` overwrites any currently visible toast. If `showToast` is called twice within 3 seconds, the second call's `textContent` replaces the first, and the first's `setTimeout` may prematurely hide the second. Fix: maintain a message queue, show one at a time, advance on dismiss/timeout.

**Files:**
- `src/lib/toast.ts`

**Acceptance:** Multiple rapid `showToast()` calls show each message sequentially, each for 3 seconds.

---

### #16 — Refresh Categories in Extension Popup During Pending Flow

**Status:** ❌ Not started

**Description:** `advanceToNext()` in `popup/App.tsx:215-237` re-fetches pending bookmarks but never calls `GET_CATEGORIES` to refresh the category dropdown. After confirming a bookmark, the category list may be stale (category added/renamed by main app in the meantime). Fix: send `GET_CATEGORIES` message at the start of `advanceToNext()`.

**Files:**
- `extension/entrypoints/popup/App.tsx`

**Acceptance:** After confirming a pending bookmark, the popup dropdown shows the latest categories from the server.

---

### #17 — Enable Firestore IndexedDB Persistence

**Status:** ❌ Not started

**Description:** `firebase.ts` doesn't call `enableIndexedDbPersistence(db)`. Without it, Firestore queries fail when offline. Add the persistence call with appropriate error handling for multiple-tab scenarios.

**Files:**
- `src/lib/firebase.ts`

**Acceptance:** Firestore reads work offline (from IndexedDB cache) when the network is unavailable.

---

## 5. Tier 3: Polish

### #18 — Add ShortcutGrid Empty State

**Status:** ✅ Done

**Description:** `ShortcutGrid.tsx:223` returns `null` when `categories.length === 0`. A first-time user sees a blank area with no guidance. Add a centered empty state with a welcome message and instructions.

**Files:**
- `src/components/ShortcutGrid.tsx`
- `src/styles/css/widgets.css`

**Acceptance:** New user with no categories sees "Welcome to Foyer! Add your first shortcut" message with a button/link to add a section.

---

### #19 — Add Offline/Error Widget CSS

**Status:** ✅ Done

**Description:** No `.widget-error`, `.weather-error`, `.news-error`, or any error state styles exist. Widgets have loading skeletons and an empty news state (`.news-empty` at line 1030), but nothing for error states. Define styles for: error icon, error message, retry button, muted styling.

**Files:**
- `src/styles/css/widgets.css`

**Acceptance:** Error state CSS classes exist and are visually distinct (muted opacity, subtle border, retry button styling).

---

### #20 — Add Widget Retry UI

**Status:** ✅ Done

**Description:** When `error` is non-null from the hooks (see #11), widgets should show an error message + "Retry" button instead of remaining blank or showing stale data. Implement in the widget components.

**Files:**
- `src/components/WeatherWidget.tsx`
- `src/components/NewsWidget.tsx`
- `src/components/WallpaperWidget.tsx`
- `src/styles/css/widgets.css`

**Acceptance:** When a widget's data fetch fails, the widget shows an error state with a clickable "Retry" button that re-fetches. Depends on #11 and #19.
