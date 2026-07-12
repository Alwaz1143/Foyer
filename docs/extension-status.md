# Extension Development Status

> Live status tracker for the Foyer browser extension build-out.
> Update this file as work progresses to maintain context across sessions.

**Last Updated:** 2026-07-12 (Phase 2 completed)
**Project Version:** 2.0.0
**Extension Version:** 1.0.0

---

## Overall Progress

| Phase | Title | Status | % Complete |
|-------|-------|--------|-----------|
| 3 | Extension Scaffold | ✅ Complete | 100% |
| 4 | Bookmark Interception | 🟡 Partial | 85% |
| 5 | Cross-Device Sync | 🟡 Partial | 40% |
| 1 | Confidence-Based Popup | ✅ Complete | 100% |
| 2 | First-Login Bookmark Prompt | ✅ Complete | 100% |
| 6 | Badge Enhancements | ❌ Not Started | 0% |
| 7 | Shared Code Sync | ❌ Not Started | 0% |
| 8 | Google Sign-In | ❌ Not Started | 0% |

**Legend:** ✅ Complete | 🟡 In Progress / Partial | ❌ Not Started

---

## Detailed Status

### Phase 3 — Extension Scaffold ✅

| Task | Status | Notes |
|------|--------|-------|
| WXT project setup | ✅ Done | `wxt.config.ts`, MV3 manifest |
| Firebase init | ✅ Done | `extension/lib/firebase.ts` (with hardcoded config) |
| Auth (Email/Password) | ✅ Done | `extension/lib/auth.ts` |
| Popup UI shell | ✅ Done | `App.tsx` with sign-in form |
| "Add Current Page" | ✅ Done | `ADD_CURRENT_PAGE` message handler |
| Sync button | ✅ Done | `SYNC_ALL_BOOKMARKS` message handler |
| Icons generation | ✅ Done | `scripts/generate-icons.mjs` + Sharp |

### Phase 4 — Bookmark Interception 🟡 Partial (85%)

| Task | Status | Notes |
|------|--------|-------|
| `chrome.bookmarks.onCreated` listener | ✅ Done | `background.ts:164` |
| Classifier wired to background | ✅ Done | Uses shared `classifySite()` |
| Offline bookmark queue | ✅ Done | Flushed on auth |
| Dedup on add | ✅ Done | `normalizeUrl()` check before write |
| Shared code copied | ✅ Done | `extension/shared/*` (manual copy) |
| Confidence-based popup | ✅ **Done** | See Phase 1 |
| Medium/Low confidence path | ✅ **Done** | Stored as pending, shown in popup |
| Pending bookmark storage | ✅ **Done** | `chrome.storage.local` (`pendingBookmarks` array) |

**Current behavior:** High confidence → silent add with badge. Medium/Low/None → stored as pending in `chrome.storage.local`, badge shows `"!"`. Popup opens to show confirmation UI with category selector, confidence badge, Add/Skip/Dismiss All buttons.

### Phase 5 — Cross-Device Sync 🟡 Partial (40%)

| Task | Status | Notes |
|------|--------|-------|
| Polling (30s) | ✅ Done | `background.ts:211-217` |
| Bulk sync (`SYNC_ALL_BOOKMARKS`) | ✅ Done | `background.ts:160-205` |
| Badge counter | ✅ Done | `background.ts:105-110` |
| Install handler | ✅ Done | Sets badge to `"!"` on install |
| Message hub | ✅ Done | Handles 6 message types |
| **onInstalled → syncAllBookmarks** | ❌ **Not Done** | Currently only sets badge |
| **pendingExtensionImport Firestore doc** | ❌ **Not Done** | No type or collection exists |
| **`?extensionImport=true` web handler** | ❌ **Not Done** | Not in `page.tsx` |
| **Chrome tab open on install** | ❌ **Not Done** | Not implemented |
| **`extensionLinked` setting** | ❌ **Not Done** | Not in `types.ts` or Firestore |

### Phase 1 — Confidence-Based Popup ✅ Complete (100%)

| Task | Status | Notes |
|------|--------|-------|
| `addBookmarkToFoyer` returns full classification | ✅ Done | Returns `{ added, alreadyExists, categoryName, classification }` |
| `onBookmarkCreated` routes by confidence | ✅ Done | High → silent add. Medium/Low/None → store as pending |
| `chrome.storage.local` for pending data | ✅ Done | `pendingBookmarks` array, `storePendingBookmark`/`clearPendingBookmark` helpers |
| `CONFIRM_BOOKMARK` message handler | ✅ Done | Accepts `{ index, title, url, folderHint, categoryId }` |
| `GET_PENDING_BOOKMARKS` message handler | ✅ Done | Returns pending array from storage |
| `SKIP_PENDING_BOOKMARK` message handler | ✅ Done | Removes single pending item |
| `CLEAR_PENDING_BOOKMARKS` message handler | ✅ Done | Wipes all pending + resets badge |
| Popup confirmation UI | ✅ Done | New `"pending"`/`"confirming"` states in `App.tsx` |
| Confidence badge in popup | ✅ Done | Color-coded dot + label (🟢🟡🔴⚪) |
| Category dropdown in confirmation | ✅ Done | Auto-selects detected category, user can override |
| Add/Skip/Dismiss All buttons | ✅ Done | Per-item Add/Skip + bulk Dismiss All |
| Badge updates | ✅ Done | Shows `"!"` for pending, count for silent adds, tooltip with category name |

**Files changed:**
- `extension/entrypoints/background.ts` — Major rewrite of `addBookmarkToFoyer`, `onBookmarkCreated`, `syncAllBookmarks`; added 4 new message handlers + pending storage helpers
- `extension/entrypoints/popup/App.tsx` — Added `"pending"`/`"confirming"` states, pending bookmark queue, confirmation card, category selector
- `extension/entrypoints/popup/styles.css` — Added 80+ lines of styles for pending card, confidence badge, select group, action buttons

### Phase 2 — First-Login Bookmark Prompt ✅ Complete (100%)

| Task | Status | Notes |
|------|--------|-------|
| `bookmarkImportPromptShown` field in `UserSettings` | ✅ Done | Added to `src/lib/types.ts` |
| Firestore read + lifecycle | ✅ Done | Handled in `page.tsx` via `getDoc` on mount, `setDoc` on action |
| First-login prompt modal HTML | ✅ Done | Added after import modal with "Import Now" / "Maybe Later" + close |
| Prompt logic (`useEffect`) | ✅ Done | Checks `settings.bookmarkImportPromptShown`, shows once per session via `window.__bookmarkPromptShown` guard |
| Modal styles | ✅ Done | Reuses existing `.modal` / `.modal-content` / `.modal-header` / `.modal-form` / `.modal-actions` classes |

### Phase 6 — Badge Enhancements ❌ Not Started (0%)

| Task | Status | Notes |
|------|--------|-------|
| `chrome.storage.local` badge count | ❌ Not Started | Currently in-memory only |
| Tooltip with category name | ❌ Not Started | `chrome.action.setTitle()` |
| Clear badge on popup open | ❌ Not Started | In `App.tsx` |

### Phase 7 — Shared Code Auto-Sync ❌ Not Started (0%)

| Task | Status | Notes |
|------|--------|-------|
| Sync script (`scripts/sync-shared.js`) | ❌ Not Started | Need to create |
| npm script `sync:shared` | ❌ Not Started | Not in `package.json` |
| Prebuild hook in extension | ❌ Not Started | Not in `extension/package.json` |

### Phase 8 — Google Sign-In ❌ Not Started (0%)

| Task | Status | Notes |
|------|--------|-------|
| `identity` permission | ❌ Not Started | Not in `wxt.config.ts` |
| Google OAuth flow | ❌ Not Started | Complex — needs `signInWithRedirect` + tab |
| "Sign in with Google" button | ❌ Not Started | Not in `App.tsx` |

---

## Shared Code Sync Status

> Both `src/lib/` and `extension/shared/` must be kept in sync.

| File | `src/lib/` | `extension/shared/` | In Sync? |
|------|-----------|-------------------|----------|
| `types.ts` | ✅ | ✅ | ✅ Identical |
| `domainMap.ts` | ✅ | ✅ | ✅ Identical |
| `classifySite.ts` | ✅ | ✅ | ✅ Identical (minor: `candidates[0] ?? null` added to extension) |
| `normalizeUrl.ts` | ✅ | ✅ | ✅ Identical |
| `utils.ts` | ✅ | ✅ | ✅ Minor diff: `extension/shared/utils.ts` missing `escapeHtml` |

---

## Implemented vs Planned Features in Background.ts

### Message Handlers — Current State

| Message Type | Implemented? | Notes |
|-------------|-------------|-------|
| `USER_SIGNED_IN` | ✅ | Refreshes categories + flushes queue |
| `ADD_CURRENT_PAGE` | ✅ | With dedup |
| `SYNC_ALL_BOOKMARKS` | ✅ | Full tree sync |
| `GET_AUTH_STATUS` | ✅ | Boolean check |
| `GET_CATEGORIES` | ✅ | Returns cached categories |
| `SET_MIRROR_DELETIONS` | ✅ | Sets `mirrorDeletions` flag |
| `GET_PENDING_BOOKMARKS` | ✅ | Returns pending from `chrome.storage.local` |
| `CONFIRM_BOOKMARK` | ✅ | Confirms pending with optional category override |
| `SKIP_PENDING_BOOKMARK` | ✅ | Removes single pending item |
| `CLEAR_PENDING_BOOKMARKS` | ✅ | Wipes all pending + resets badge |
| `SET_EXTENSION_SYNC_ENABLED` | ❌ | Needed for Phase 4 |
| `GET_SETTINGS` | ❌ | Needed for Phase 4 |

### Event Listeners — Current State

| Event | Implemented? | Notes |
|-------|-------------|-------|
| `chrome.bookmarks.onCreated` | ✅ | With offline queue |
| `chrome.bookmarks.onRemoved` | ❌ | Needed for Phase 5 |
| `chrome.runtime.onInstalled` | ✅ | Minimal — just sets badge |
| `chrome.runtime.onMessage` | ✅ | 6 message types handled |

---

## Known Issues / Technical Debt

1. **Hardcoded Firebase config in extension** — `extension/lib/firebase.ts` has API keys in plaintext. Should use `.env` or WXT's public env vars.
2. **No error recovery in `pollInterval`** — If a Firestore read fails, polling silently fails. No retry logic.
3. **`syncInProgress` flag not exposed to popup** — Popup can't tell if a sync is running.
4. **`onUserChanged` unsubscription not tracked** — `onInstalled` would need to unsubscribe from auth listener; currently there's no mechanism.
5. **`escapeHtml` missing from extension shared utils** — `extension/shared/utils.ts` is missing this function compared to `src/lib/utils.ts`.
6. **No loading indicator for initial sync** — Bulk sync can be slow for thousands of bookmarks but gives no progress feedback.

---

## Per-Session Changelog

| Date | Session | Work Done |
|------|---------|-----------|
| 2026-07-12 | Initial | Full codebase analysis, created plan + status docs |
| 2026-07-12 | Phase 1 | Implemented confidence-based popup flow. Changed `addBookmarkToFoyer` to return full classification. `onBookmarkCreated` routes by confidence: high=silent add, medium/low/none=store as pending in `chrome.storage.local`. Added 4 new message handlers (`GET_PENDING_BOOKMARKS`, `CONFIRM_BOOKMARK`, `SKIP_PENDING_BOOKMARK`, `CLEAR_PENDING_BOOKMARKS`). Replaced `findOrCreateMatchingCategory` with direct `classifySite` calls. Updated popup with `"pending"`/`"confirming"` states, confirmation card with confidence badge, category dropdown, Add/Skip/Dismiss All buttons. Removed old `findOrCreateMatchingCategory` from `syncAllBookmarks`. Fixed bug: `categoryId` → `result.categoryId` in sync. **Build verified — 0 errors.** |
| 2026-07-12 | Phase 2 | Added `bookmarkImportPromptShown` field to `UserSettings` in `src/lib/types.ts`. Added first-login prompt `useEffect` in `page.tsx` that reads `users/{uid}.settings.bookmarkImportPromptShown` from Firestore on mount (after categories load). On "Import Now" → sets flag to `true` and opens import modal. On "Maybe Later" / close → sets flag to `true` and closes. Uses `window.__bookmarkPromptShown` ref guard to show once per session. No additional CSS needed (reuses existing modal classes). Copied updated types to `extension/shared/types.ts`. **Build verified — 0 errors.** |
| 2026-07-12 | Phase A1 | Modified `importBookmarks` in `CategoriesContext.tsx` to auto-handle uncategorized bookmarks when `autoCreateCategories` is ON: groups by root domain, creates sections for domains with 3+ bookmarks (e.g., `github.com` → `🌐 Github.com`), and a catch-all `📂 Uncategorized` section for leftovers. Uncategorized is no longer silently dropped — always stored somewhere. |
| 2026-07-12 | Phase A2 | Added secondary prompt UI in import done screen (`page.tsx`). When `autoCreate` is OFF and there are uncategorized bookmarks, shows action bar with: [Create sections by domain] → re-imports with autoCreate ON, [category dropdown + Add Here] → adds to selected section, [Skip] → dismisses. Added `uncategorizedCategorySelect` to the shared category dropdown population effect. **Build verified — 0 errors.** |

---

## Key Contacts / References

- Architecture doc: `docs/bookmark-import-and-auto-organize.md`
- Dev plan: `docs/extension-development-plan.md`
- This file: `docs/extension-status.md`
- Web app lib (reference): `src/lib/`
- Extension shared (copy): `extension/shared/`
- Extension bg logic: `extension/entrypoints/background.ts`
- Extension popup: `extension/entrypoints/popup/App.tsx`
