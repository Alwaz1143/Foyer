# Extension Development Plan

> Detailed, actionable plan for completing the Foyer browser extension.
> Covers phases, implementation steps, file-by-file changes, and testing guidance.

---

## Table of Contents

1. [Priority & Effort Matrix](#1-priority--effort-matrix)
2. [Phase 1: Confidence-Based Popup (High Priority)](#phase-1-confidence-based-popup)
3. [Phase 2: First-Login Bookmark Prompt (Medium Priority)](#phase-2-first-login-bookmark-prompt)
4. [Phase 3: Extension Install → Bulk Sync Handoff (High Priority)](#phase-3-extension-install--bulk-sync-handoff)
5. [Phase 4: Settings Persistence & Sync Toggles (Medium Priority)](#phase-4-settings-persistence--sync-toggles)
6. [Phase 5: Bookmark Deletion Mirroring (Low Priority)](#phase-5-bookmark-deletion-mirroring)
7. [Phase 6: Badge Enhancements & Notifications (Low Priority)](#phase-6-badge-enhancements--notifications)
8. [Phase 7: Shared Code Auto-Sync (Medium Priority)](#phase-7-shared-code-auto-sync)
9. [Phase 8: Google Sign-In for Extension (Low Priority)](#phase-8-google-sign-in-for-extension)

---

## 1. Priority & Effort Matrix

| # | Feature | Priority | Effort | Dependencies |
|---|---------|----------|--------|-------------|
| 1 | Confidence-based popup | High | Medium | None |
| 2 | First-login import prompt | Medium | Small | None |
| 3 | Extension install → bulk sync handoff | High | Medium | Phase 4 (settings) |
| 4 | Settings persistence + sync toggles | Medium | Medium | None |
| 5 | Bookmark deletion mirroring | Low | Small | Phase 4 (mirrorDeletions setting) |
| 6 | Badge enhancements & notifications | Low | Small | Phase 1 |
| 7 | Shared code auto-sync | Medium | Small | None |
| 8 | Google Sign-In for extension | Low | Large | None |

---

## Phase 1: Confidence-Based Popup

### Goal
Show the extension popup automatically when a user bookmarks a page with medium/low/none confidence, so they can confirm or override the category.

### Implementation Steps

#### Step 1.1 — Return confidence from `addBookmarkToFoyer`
**File:** `extension/entrypoints/background.ts`

**Current behavior** (line 53-83):
```typescript
async function addBookmarkToFoyer(...): Promise<{ added: boolean; categoryName?: string }>
```

**Needs to become:**
```typescript
async function addBookmarkToFoyer(
  title: string,
  url: string,
  folderHint?: string
): Promise<{
  added: boolean;
  categoryName?: string;
  confidence: "high" | "medium" | "low" | "none";
  suggestedCategoryName: string | null;
  classification: ClassificationResult;
}> {
```

- Call `classifySite()` and store the full result
- Return `confidence`, `suggestedCategoryName`, and the full `ClassificationResult`
- If no category match, include that info so UI can show all categories

#### Step 1.2 — Update `onBookmarkCreated` to open popup conditionally
**File:** `extension/entrypoints/background.ts`

Replace the current silent-add path (line 114-140):

```
if result.confidence === "high"   → silent add (current behavior)
if result.confidence === "medium" → chrome.action.openPopup() + store pending bookmark
if result.confidence === "low"    → chrome.action.openPopup() + store pending bookmark
if result.confidence === "none"   → chrome.action.openPopup() + store pending bookmark
```

Use `chrome.storage.local` to persist the pending bookmark data:
```typescript
await chrome.storage.local.set({
  pendingBookmark: {
    title: bookmark.title,
    url: bookmark.url,
    folderHint: folderName,
    classification: result,
  }
});
await chrome.action.openPopup();
```

#### Step 1.3 — Add confirmation UI to popup
**File:** `extension/entrypoints/popup/App.tsx`

Add a new `PageState` value: `"confirm"`.

When popup opens:
1. Read `chrome.storage.local.get("pendingBookmark")`
2. If exists → show confirmation UI instead of the main "Add to Foyer" view
3. Show: title, URL, detected category (or "Uncategorized"), category dropdown
4. Buttons: **Add** (sends `CONFIRM_BOOKMARK` message) | **Skip** (clears pending, closes)

#### Step 1.4 — Add `CONFIRM_BOOKMARK` message handler
**File:** `extension/entrypoints/background.ts`

New message type `CONFIRM_BOOKMARK`:
- Receives `{ title, url, folderHint, categoryId }`
- Calls `addSiteToCategory()` with the confirmed category
- Clears `chrome.storage.local` pending data
- Returns success

#### Step 1.5 — Update popup styles
**File:** `extension/entrypoints/popup/styles.css`

Add styles for:
- Confirmation card with title/URL preview
- Category dropdown with auto-selection
- Confidence badge (🟢/🟡/🟠/⚪)
- Add/Skip buttons

---

## Phase 2: First-Login Bookmark Prompt

### Goal
Show a one-time modal in the web app when a user logs in for the first time, asking if they want to import browser bookmarks.

### Implementation Steps

#### Step 2.1 — Add `bookmarkImportPromptShown` to types
**File:** `src/lib/types.ts`

Add to `UserSettings`:
```typescript
bookmarkImportPromptShown?: boolean;
```

#### Step 2.2 — Firestore seed includes the flag
**File:** `src/contexts/AuthGuard.tsx` or `src/contexts/CategoriesContext.tsx`

When a new user document is created, set:
```typescript
{ settings: { bookmarkImportPromptShown: false } }
```

Current `AuthGuard.tsx` (line 27-43) creates the user doc — expand to include settings.

#### Step 2.3 — Add first-login prompt modal
**File:** `src/app/page.tsx`

Add a new modal (hidden by default):
```html
<div id="firstLoginPromptModal" className="modal">
  <div className="modal-content">
    <h2>📚 Welcome to Foyer!</h2>
    <p>Want to import your browser bookmarks into Foyer?</p>
    <p>Foyer will automatically categorize them into sections.</p>
    <div className="modal-actions">
      <button id="firstLoginLaterBtn">Maybe Later</button>
      <button id="firstLoginImportBtn">Import Now</button>
    </div>
  </div>
</div>
```

#### Step 2.4 — Wire up prompt logic
**File:** `src/app/page.tsx`

Add a `useEffect` that:
1. On auth resolve + categories loaded, Firestore check `settings.bookmarkImportPromptShown`
2. If `false` → show modal
3. "Import Now" → closes modal, opens Bookmark import modal, sets flag to `true`
4. "Maybe Later" → closes modal, sets flag to `true` in Firestore

#### Step 2.5 — Add modal styles
**File:** `src/styles/css/modals.css`

Add `.first-login-prompt` styles (centered card, illustration, two-button layout).

---

## Phase 3: Extension Install → Bulk Sync Handoff

### Goal
When the extension is first installed and the user signs in, automatically sync all browser bookmarks and hand off to the web app for review.

### Implementation Steps

#### Step 3.1 — Add `pendingExtensionImport` type
**File:** `src/lib/types.ts` and `extension/shared/types.ts`

```typescript
export interface PendingExtensionImport {
  bookmarks: ParsedBookmark[];
  createdAt: number;
  status: "pending" | "imported" | "dismissed";
}
```

#### Step 3.2 — Add Firestore write helper
**File:** `extension/lib/firestore.ts`

```typescript
export async function setPendingImport(
  uid: string,
  bookmarks: ParsedBookmark[]
): Promise<void> {
  await setDoc(doc(db, "users", uid, "pendingExtensionImport", "current"), {
    bookmarks,
    createdAt: Date.now(),
    status: "pending",
  });
}

export async function clearPendingImport(uid: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "pendingExtensionImport", "current"));
}
```

#### Step 3.3 — Update `onInstalled` to trigger sync
**File:** `extension/entrypoints/background.ts`

Replace the current badge-only handler (line 228-233):

```typescript
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // Wait for auth...
    onUserChanged(async (user) => {
      if (!user) return;

      // Check if already linked
      const settings = await getSettingsFromFirestore(user.uid); // needs getSettings helper
      if (settings.extensionLinked) return;

      // Read all bookmarks
      const tree = await chrome.bookmarks.getTree();
      const flat = flattenBookmarkTree(tree);

      // Classify each
      const categories = await getCategories(user.uid);
      const classified = flat.map(b => ({
        ...b,
        classification: classifySite(b.title, b.url, categories, b.folder),
      }));

      // Write to Firestore pending import doc
      await setPendingImport(user.uid, classified);

      // Mark extension as linked
      await updateSettings(user.uid, { extensionLinked: true, lastExtensionSync: Date.now() });

      // Open web app
      chrome.tabs.create({ url: chrome.runtime.getURL("")?.replace("chrome-extension://...", "") || "https://foyer.app/?extensionImport=true" });

      // Unsubscribe the one-time listener
      unsub();
    });
  }
});
```

#### Step 3.4 — Add `getSettings` helper in extension
**File:** `extension/lib/firestore.ts`

```typescript
export async function getSettings(uid: string): Promise<Record<string, any>> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.data()?.settings || {};
  } catch {
    return {};
  }
}
```

#### Step 3.5 — Handle `?extensionImport=true` in web app
**File:** `src/app/page.tsx`

Add a `useEffect` that:
1. Checks `window.location.search` for `extensionImport=true`
2. Reads `users/{uid}/pendingExtensionImport/current` from Firestore
3. If `status === "pending"`:
   - Opens the Bookmark Import modal in preview mode
   - Pre-populates the preview table with the pending bookmarks
4. On import complete: sets `status: "imported"` in Firestore
5. On dismiss: sets `status: "dismissed"`

#### Step 3.6 — Read and clear pending import in Firestore
**File:** `src/lib/firestore.ts` (create if needed) or add to existing helpers

```typescript
export async function getPendingImport(uid: string) { ... }
export async function updatePendingImportStatus(uid: string, status: string) { ... }
```

---

## Phase 4: Settings Persistence & Sync Toggles

### Goal
Persist extension settings to Firestore and allow user toggles (auto-sync on/off, mirror deletions on/off).

### Implementation Steps

#### Step 4.1 — Add extension settings fields
**File:** `src/lib/types.ts`

```typescript
// Add to UserSettings:
extensionLinked?: boolean;
lastExtensionSync?: number;
extensionSyncEnabled?: boolean;
mirrorDeletions?: boolean;
```

#### Step 4.2 — Firestore user doc on extension sign-in
**File:** `extension/lib/firestore.ts`

Add `updateSettings`:
```typescript
export async function updateSettings(
  uid: string,
  updates: Record<string, any>
): Promise<void> {
  await setDoc(
    doc(db, "users", uid),
    { settings: updates },
    { merge: true }
  );
}
```

#### Step 4.3 — Read settings on extension startup
**File:** `extension/entrypoints/background.ts`

In `onUserChanged` callback, after getting the user:
```typescript
const settings = await getSettings(user.uid);
mirrorDeletions = settings.mirrorDeletions ?? false;
if (settings.extensionSyncEnabled === false) {
  stopPolling();
} else {
  startPolling();
}
```

#### Step 4.4 — Add settings popup UI
**File:** `extension/entrypoints/popup/App.tsx`

Add a settings gear icon on the popup that opens a small settings panel:
- "Auto-sync new bookmarks" toggle
- "Mirror bookmark deletions" toggle
- "Last synced" timestamp display

Send `SET_EXTENSION_SYNC_ENABLED` and `SET_MIRROR_DELETIONS` messages.

#### Step 4.5 — Add message handlers for toggles
**File:** `extension/entrypoints/background.ts`

```typescript
case "SET_EXTENSION_SYNC_ENABLED": {
  // Stop/start polling
  sendResponse({ success: true });
}
```

---

## Phase 5: Bookmark Deletion Mirroring

### Goal
Optionally delete sites from Foyer when the user deletes a browser bookmark.

### Implementation Steps

#### Step 5.1 — Register `onRemoved` listener
**File:** `extension/entrypoints/background.ts`

```typescript
chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  if (!mirrorDeletions || !currentUser) return;
  // The removeInfo.node has url
  // Find matching site in cachedCategories by normalizeUrl
  // Delete from Firestore
});
```

#### Step 5.2 — Add Firestore delete helper
**File:** `extension/lib/firestore.ts`

```typescript
export async function removeSiteByUrl(
  uid: string,
  url: string
): Promise<boolean> {
  const normalized = normalizeUrl(url);
  const cats = await getCategories(uid);
  for (const cat of cats) {
    for (const site of cat.websites) {
      if (normalizeUrl(site.url) === normalized) {
        await deleteDoc(doc(db, "users", uid, "categories", cat.id, "websites", site.id));
        return true;
      }
    }
  }
  return false;
}
```

#### Step 5.3 — Wire in background
**File:** `extension/entrypoints/background.ts`

In the `onRemoved` handler, call `removeSiteByUrl` and refresh categories.

---

## Phase 6: Badge Enhancements & Notifications

### Goal
Show meaningful badge notifications instead of just a raw count.

### Implementation Steps

#### Step 6.1 — Track per-session badge count in `chrome.storage.local`
**File:** `extension/entrypoints/background.ts`

```typescript
async function incrementBadge() {
  const result = await chrome.storage.local.get("badgeCount");
  const count = (result.badgeCount || 0) + 1;
  await chrome.storage.local.set({ badgeCount: count });
  await chrome.action.setBadgeText({ text: count.toString() });
}
```

#### Step 6.2 — Tooltip with category name on badge
**File:** `extension/entrypoints/background.ts`

Use `chrome.action.setTitle()` to update the tooltip:
```typescript
await chrome.action.setTitle({ title: `Added to ${result.categoryName}` });
```

#### Step 6.3 — Clear badge on popup open
**File:** `extension/entrypoints/popup/App.tsx`

```typescript
// On popup mount
chrome.action.setBadgeText({ text: "" });
```

---

## Phase 7: Shared Code Auto-Sync

### Goal
Prevent divergence between `src/lib/` (web app) and `extension/shared/` (extension).

### Implementation Steps

#### Step 7.1 — Create sync script
**File:** `scripts/sync-shared.js` (at project root)

```javascript
// Copies src/lib/domainMap.ts, classifySite.ts, normalizeUrl.ts, types.ts, utils.ts
// to extension/shared/
// Uses fs.watchFile or runs once
```

Run as: `npm run sync:shared`

#### Step 7.2 — Add npm script
**File:** `package.json`

```json
"sync:shared": "node scripts/sync-shared.js"
```

#### Step 7.3 — Add pre-build check
**File:** `extension/package.json`

```json
"prebuild": "node ../scripts/sync-shared.js"
```

#### Step 7.4 — Add git hook suggestion
Document in README that contributors should run `npm run sync:shared` before extension work, or set up a git pre-commit hook that checks file hashes.

---

## Phase 8: Google Sign-In for Extension

### Goal
Allow users who signed up with Google to use the extension without creating a separate Email/Password credential.

### Implementation Steps

#### Step 8.1 — Add `chrome.identity` permission
**File:** `extension/wxt.config.ts`

```typescript
permissions: ["bookmarks", "storage", "tabs", "identity"],
```

#### Step 8.2 — Add Google OAuth in background
**File:** `extension/entrypoints/background.ts`

```typescript
async function signInWithGoogle() {
  // Use chrome.identity.getAuthToken or Firebase signInWithRedirect with chrome.identity
  // Complex because Firebase doesn't natively support chrome.identity
  // Alternative: Open a popup tab pointing to a custom auth page
}
```

#### Step 8.3 — Add "Sign in with Google" button to popup
**File:** `extension/entrypoints/popup/App.tsx`

Add Google button alongside email/password form.

> **Note:** This is significantly more complex than email/password because Firebase's `signInWithPopup` requires a real browser window, not a service worker. Recommended approach: open a new tab for Google OAuth, listen for the result via `chrome.runtime.onMessage` or `chrome.storage.onChanged`.

---

## Testing Checklist

This section is meant to be checked off as each phase is implemented.

### Phase 1 — Confidence-Based Popup
- [ ] `addBookmarkToFoyer` returns full `ClassificationResult`
- [ ] `onBookmarkCreated` opens popup for medium/low/none confidence
- [ ] `onBookmarkCreated` silently adds for high confidence
- [ ] Popup shows pending bookmark info
- [ ] Popup allows category override
- [ ] "Skip" clears pending and closes
- [ ] Pending data is cleared after import

### Phase 2 — First-Login Prompt
- [ ] New user sees prompt on first login
- [ ] "Import Now" opens Bookmark Import modal
- [ ] "Maybe Later" dismisses permanently
- [ ] `bookmarkImportPromptShown` persists in Firestore
- [ ] Returning users never see the prompt again

### Phase 3 — Install → Sync Handoff
- [ ] `onInstalled` triggers sync after auth
- [ ] All browser bookmarks are read and classified
- [ ] `pendingExtensionImport` doc written to Firestore
- [ ] `extensionLinked: true` saved to Firestore
- [ ] Web app tab opens with `?extensionImport=true`
- [ ] Web app reads pending import and shows preview
- [ ] Status updates to "imported" on completion

### Phase 4 — Settings
- [ ] Settings load from Firestore on extension start
- [ ] "Auto-sync" toggle stops/starts polling
- [ ] "Mirror deletions" toggle is persisted
- [ ] Settings UI in popup works

### Phase 5 — Deletion Mirroring
- [ ] `onRemoved` listener fires
- [ ] Site deleted from Firestore when bookmark is removed
- [ ] No deletion when `mirrorDeletions` is off

### Phase 6 — Badge
- [ ] Badge shows count of auto-added bookmarks
- [ ] Tooltip shows category name
- [ ] Badge clears when popup opens

### Phase 7 — Shared Sync
- [ ] `npm run sync:shared` copies files
- [ ] Extension builds consistently after sync
- [ ] README documents the process

### Phase 8 — Google Sign-In
- [ ] "Sign in with Google" button appears
- [ ] OAuth flow completes
- [ ] Extension is authenticated and can read/write Firestore

---

## File Change Summary

| File | Phase(s) | Change |
|------|----------|--------|
| `extension/entrypoints/background.ts` | 1, 3, 4, 5, 6 | Return classification, open popup conditionally, onInstalled sync, settings w/ toggles, onRemoved listener, badge enhancements |
| `extension/entrypoints/popup/App.tsx` | 1, 4, 6, 8 | Confirmation UI, settings panel, badge clear, Google button |
| `extension/lib/firestore.ts` | 3, 4, 5 | `setPendingImport`, `getSettings`, `updateSettings`, `removeSiteByUrl` |
| `extension/shared/types.ts` | 3 | `PendingExtensionImport` type |
| `extension/wxt.config.ts` | 8 | `identity` permission |
| `src/lib/types.ts` | 2, 4 | `bookmarkImportPromptShown`, extension settings fields |
| `src/app/page.tsx` | 2, 3 | First-login prompt modal, `?extensionImport=true` handler |
| `src/styles/css/modals.css` | 2 | First-login prompt styles |
| `src/contexts/AuthGuard.tsx` or `CategoriesContext.tsx` | 2 | Seed `bookmarkImportPromptShown: false` |
| `scripts/sync-shared.js` | 7 | New file: auto-copy script |
| `package.json` | 7 | `sync:shared` npm script |
| `extension/package.json` | 7 | `prebuild` hook |
