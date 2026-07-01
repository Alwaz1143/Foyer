# Bookmark Import, Auto-Organize & Extension Sync — Complete Plan

## Overview

Three interconnected features, built in layers:

1. **Auto-classify** — when any site is added, Foyer automatically detects the right category
2. **Bookmark import (web)** — import browser bookmark HTML export with auto-categorization + preview
3. **Foyer Browser Extension** — companion extension that intercepts the native ★ button, one-click adds sites to Foyer, and syncs all bookmarks across devices automatically via the same Firebase account

The web app and extension share the **same Firebase project, same Firestore database, same auth**. They are two entry points into the same data layer — no separate backend needed.

---

## Architecture

### Shared Data Layer

```
┌─────────────────────┐     ┌─────────────────────┐
│   Foyer Web App     │     │  Foyer Extension    │
│  (Next.js / React)  │     │  (Chrome/Firefox)   │
└────────┬────────────┘     └────────┬────────────┘
         │                           │
         └──────────┬────────────────┘
                    │  Firebase Auth (same account)
                    │  Firestore (same user document)
                    ▼
         ┌──────────────────┐
         │    Firestore     │
         │  users/{uid}/    │
         │    categories/   │
         │    websites/     │
         │  settings {      │
         │    bookmarkImportPromptShown,  │
         │    extensionLinked,            │
         │    lastExtensionSync           │
         │  }               │
         └──────────────────┘
```

Both the web app and extension write to and read from the same Firestore collections. Real-time sync is automatic — changes made in the extension appear in the web app within seconds (Firestore real-time listeners) and vice versa.

### How Extension ↔ Web App Auth Works

The extension uses **Firebase Web SDK** directly — same `firebaseConfig` as the web app. The user signs in once in the web app; the extension reads the same Firebase auth token via `chrome.storage` or `chrome.identity`. No separate login required.

```
User logs in on Foyer web app
      ↓
Extension checks: am I already authenticated?
  → Yes: uses same Firestore session
  → No: opens a Firebase OAuth popup from the extension's background service worker
```

---

## Classification Engine (Shared between Web + Extension)

This logic lives in `src/lib/` and is compiled into both the web app and the extension's bundle.

### `src/lib/domainMap.ts` — CREATE

A curated `Record<string, string[]>` of 300+ root domains → candidate category names. Domains map to an ordered list: first match against existing user categories wins.

```typescript
export const domainCategoryMap: Record<string, string[]> = {
  // Social
  "twitter.com":         ["Social Media", "Social"],
  "x.com":               ["Social Media", "Social"],
  "instagram.com":       ["Social Media", "Social"],
  "reddit.com":          ["Social Media", "Social"],
  "linkedin.com":        ["Social Media", "Professional", "Social"],
  "facebook.com":        ["Social Media", "Social"],
  "tiktok.com":          ["Social Media", "Social", "Entertainment"],
  "discord.com":         ["Social Media", "Social", "Gaming"],
  "snapchat.com":        ["Social Media", "Social"],
  "pinterest.com":       ["Social Media", "Social", "Design"],
  "threads.net":         ["Social Media", "Social"],
  "telegram.org":        ["Social Media", "Social"],
  "whatsapp.com":        ["Social Media", "Social"],
  "mastodon.social":     ["Social Media", "Social"],

  // Productivity
  "notion.so":           ["Productivity", "Tools"],
  "trello.com":          ["Productivity", "Tools"],
  "asana.com":           ["Productivity", "Tools"],
  "todoist.com":         ["Productivity", "Tools"],
  "slack.com":           ["Productivity", "Tools"],
  "zoom.us":             ["Productivity", "Tools"],
  "office.com":          ["Productivity", "Tools"],
  "clickup.com":         ["Productivity", "Tools"],
  "linear.app":          ["Productivity", "Development"],
  "airtable.com":        ["Productivity", "Tools"],
  "mail.google.com":     ["Productivity", "Email"],
  "drive.google.com":    ["Productivity", "Cloud Storage"],
  "calendar.google.com": ["Productivity"],
  "docs.google.com":     ["Productivity"],
  "keep.google.com":     ["Productivity"],
  "figma.com":           ["Design", "Productivity", "Creative"],

  // AI
  "chat.openai.com":     ["Artificial Intelligence", "AI", "AI Models"],
  "chatgpt.com":         ["Artificial Intelligence", "AI", "AI Models"],
  "perplexity.ai":       ["Artificial Intelligence", "AI", "AI Models"],
  "claude.ai":           ["Artificial Intelligence", "AI", "AI Models"],
  "gemini.google.com":   ["Artificial Intelligence", "AI", "AI Models"],
  "copilot.microsoft.com": ["Artificial Intelligence", "AI"],
  "huggingface.co":      ["Artificial Intelligence", "AI", "Development"],
  "midjourney.com":      ["Artificial Intelligence", "AI", "Design"],
  "stability.ai":        ["Artificial Intelligence", "AI"],
  "grok.com":            ["Artificial Intelligence", "AI", "AI Models"],
  "x.ai":                ["Artificial Intelligence", "AI"],

  // Development
  "github.com":          ["Development", "Coding", "Dev Tools"],
  "gitlab.com":          ["Development", "Coding"],
  "stackoverflow.com":   ["Development", "Coding"],
  "vercel.com":          ["Development", "Coding"],
  "netlify.com":         ["Development", "Coding"],
  "cloudflare.com":      ["Development", "Coding"],
  "npmjs.com":           ["Development", "Coding"],
  "python.org":          ["Development", "Coding"],
  "react.dev":           ["Development", "Coding"],
  "nextjs.org":          ["Development", "Coding"],
  "docker.com":          ["Development", "Coding"],
  "replit.com":          ["Development", "Coding"],
  "codepen.io":          ["Development", "Coding"],
  "codesandbox.io":      ["Development", "Coding"],
  "w3schools.com":       ["Development", "Coding"],
  "mdn.io":              ["Development", "Coding"],
  "developer.mozilla.org": ["Development", "Coding"],
  "leetcode.com":        ["Development", "Placements", "Coding"],
  "hackerrank.com":      ["Development", "Placements", "Coding"],
  "codeforces.com":      ["Development", "Placements", "Coding"],
  "codechef.com":        ["Development", "Placements", "Coding"],
  "aws.amazon.com":      ["Development", "Cloud", "Coding"],
  "console.aws.amazon.com": ["Development", "Cloud"],
  "cloud.google.com":    ["Development", "Cloud"],
  "portal.azure.com":    ["Development", "Cloud"],

  // Entertainment
  "youtube.com":         ["Entertainment"],
  "netflix.com":         ["Entertainment", "Streaming"],
  "spotify.com":         ["Entertainment", "Music"],
  "twitch.tv":           ["Entertainment", "Gaming"],
  "hulu.com":            ["Entertainment", "Streaming"],
  "disneyplus.com":      ["Entertainment", "Streaming"],
  "primevideo.com":      ["Entertainment", "Streaming"],
  "imdb.com":            ["Entertainment"],
  "soundcloud.com":      ["Entertainment", "Music"],
  "apple.com/apple-tv":  ["Entertainment", "Streaming"],

  // News & Media
  "bbc.com":             ["News & Media", "News"],
  "cnn.com":             ["News & Media", "News"],
  "reuters.com":         ["News & Media", "News"],
  "nytimes.com":         ["News & Media", "News"],
  "theguardian.com":     ["News & Media", "News"],
  "bloomberg.com":       ["News & Media", "News"],
  "wsj.com":             ["News & Media", "News"],
  "washingtonpost.com":  ["News & Media", "News"],
  "npr.org":             ["News & Media", "News"],
  "axios.com":           ["News & Media", "News"],
  "techcrunch.com":      ["News & Media", "Technology"],
  "theverge.com":        ["News & Media", "Technology"],
  "hackernews.com":      ["News & Media", "Technology", "Development"],
  "news.ycombinator.com": ["News & Media", "Technology", "Development"],
  "medium.com":          ["News & Media", "Productivity"],

  // Sports
  "espn.com":            ["Sports"],
  "skysports.com":       ["Sports"],
  "espncricinfo.com":    ["Sports", "Cricket"],
  "nba.com":             ["Sports", "Basketball"],
  "nfl.com":             ["Sports"],
  "formula1.com":        ["Sports", "Formula 1"],
  "the-athletic.com":    ["Sports"],
  "fancode.com":         ["Sports"],
  "livescore.com":       ["Sports"],

  // Gaming
  "chess.com":           ["Games", "Gaming"],
  "lichess.org":         ["Games", "Gaming"],
  "steampowered.com":    ["Games", "Gaming"],
  "epicgames.com":       ["Games", "Gaming"],
  "roblox.com":          ["Games", "Gaming"],
  "minecraft.net":       ["Games", "Gaming"],
  "skribbl.io":          ["Games", "Gaming"],
  "geoguessr.com":       ["Games", "Gaming"],
  "openguessr.com":      ["Games", "Gaming"],
  "chessable.com":       ["Games", "Gaming"],

  // Shopping
  "amazon.com":          ["Shopping"],
  "amazon.in":           ["Shopping"],
  "ebay.com":            ["Shopping"],
  "etsy.com":            ["Shopping"],
  "walmart.com":         ["Shopping"],
  "flipkart.com":        ["Shopping"],
  "aliexpress.com":      ["Shopping"],
  "buyhatke.com":        ["Shopping"],

  // Cloud Storage
  "drive.google.com":    ["Cloud Storage", "Productivity"],
  "mega.nz":             ["Cloud Storage"],
  "dropbox.com":         ["Cloud Storage"],
  "onedrive.live.com":   ["Cloud Storage"],
  "icloud.com":          ["Cloud Storage"],
  "box.com":             ["Cloud Storage"],

  // Education
  "udemy.com":           ["Courses", "Education", "Learning"],
  "coursera.org":        ["Courses", "Education", "Learning"],
  "edx.org":             ["Courses", "Education", "Learning"],
  "khanacademy.org":     ["Courses", "Education", "Learning"],
  "skillshare.com":      ["Courses", "Education", "Learning"],
  "pluralsight.com":     ["Courses", "Education", "Learning"],
  "30dayscoding.com":    ["Courses", "Coding"],
  "roadmap.sh":          ["Development", "Courses", "Coding"],
};
```

### `src/lib/classifySite.ts` — CREATE

Auto-classify a URL into the best matching existing category, with a tiered confidence system.

```typescript
export interface ClassificationResult {
  categoryId: string | null;       // ID of matched existing category
  suggestedCategoryName: string | null; // name to create if no match
  confidence: "high" | "medium" | "low" | "none";
  matchedBy: "domain" | "folder" | "keyword" | "none";
}

export function classifySite(
  name: string,
  url: string,
  existingCategories: Category[],
  folderHint?: string   // from browser bookmark folder name
): ClassificationResult
```

**Classification pipeline** (runs top-to-bottom, stops at first high-confidence match):

1. **Domain map lookup** — extract root domain, look up in `domainCategoryMap`
   - For each candidate name, try case-insensitive substring match against existing category names
   - Match → `confidence: "high"`, `matchedBy: "domain"`
   - Domain in map but no matching category → `confidence: "medium"`, suggest name

2. **Browser folder hint** — if a `folderHint` is provided (from bookmark HTML `<H3>` parent or extension folder)
   - Try substring match of folder name against existing category names
   - Match → `confidence: "medium"`, `matchedBy: "folder"`

3. **Keyword fallback** — tokenize site `name`, match words against category names
   - e.g. "Gmail Inbox" → matches "Productivity" if that category exists
   - `confidence: "low"`, `matchedBy: "keyword"`

4. **No match** → `confidence: "none"`, `categoryId: null`, `suggestedCategoryName: null`

### `src/lib/bookmarkParser.ts` — CREATE

Parse Netscape bookmark HTML (Chrome, Firefox, Edge, Safari export format).

```typescript
export interface ParsedBookmark {
  title: string;
  url: string;
  addDate?: number;       // Unix timestamp
  folder?: string;        // immediate parent folder name (primary category hint)
  folderPath?: string[];  // full folder path e.g. ["Work", "Dev", "APIs"]
  icon?: string;          // data:image/png;base64,... or https:// favicon
}

export function parseBookmarkHtml(html: string): ParsedBookmark[]
```

**Logic**:
- Use `DOMParser` to parse the HTML tree
- Walk `<DT>` elements: `<A>` = bookmark, `<H3>` = folder boundary
- Track folder stack depth for nested structure → `folderPath`
- Extract `HREF`, `ADD_DATE`, `ICON` attributes
- Filter out `javascript:` and `chrome://` internal URLs
- Normalize URLs (strip trailing slashes, ensure `https://`)

### `src/lib/normalizeUrl.ts` — CREATE

Consistent URL normalization used for dedup checks:

```typescript
export function normalizeUrl(url: string): string {
  // Strips www., forces https, removes trailing slash, lowercases host
  // https://www.Twitter.com/home/ → https://twitter.com/home
}
```

---

## Web App Features

### Phase 1: Enhanced Add-Site Modal

When the user types a URL in the "Add Site" form:
- On `blur` of URL field → call `classifySite()` → auto-select category dropdown
- Show subtle badge: `🟢 Detected: Social Media`
- User can override the dropdown; the badge is just a hint

### Phase 2: Bulk Import Modal

New **"Import Bookmarks"** button in the action bar.

**3-step flow:**

**Step 1 — Upload**
- File picker accepting `.html` files
- Calls `parseBookmarkHtml()` → array of `ParsedBookmark`
- Shows count: "Found 247 bookmarks"
- Option: "Skip bookmarks that already exist in Foyer" (ON by default — uses `normalizeUrl` dedup)

**Step 2 — Preview & Classify**
- Runs `classifySite()` on every bookmark
- Table with columns: Title, URL (truncated), Detected Category, Confidence, Override
- Filter tabs: All / High / Medium / Low / Uncategorized
- Bulk action: "Assign all Uncategorized to..." dropdown
- Toggle: "Create new categories for unmatched domains" (OFF by default)

**Step 3 — Confirm & Import**
- Progress bar as sites are added
- Summary: "Added 198 sites to 12 categories. 49 skipped (already existed). 12 uncategorized."
- Shows created categories if any

### Phase 3: First-Login Popup (Web App)

Triggered once per account, on first successful login:

```
Firestore: users/{uid}/settings.bookmarkImportPromptShown = false (default)
```

After auth resolves and Firestore load completes, if `bookmarkImportPromptShown === false`:
- Show modal: "📚 Want to import your browser bookmarks into Foyer?"
- Two options: **Import Now** (opens import modal) | **Maybe Later**
- On either choice: set `bookmarkImportPromptShown = true` in Firestore

---

## Browser Extension

### Tech Stack

- **Manifest V3** (required for Chrome Web Store; also works on Firefox with minor shim)
- **Vite + React** for the popup UI (same component patterns as web app)
- **Firebase Web SDK v10** — same `firebaseConfig` as the web app
- **Shared logic**: `domainMap.ts`, `classifySite.ts`, `normalizeUrl.ts` compiled into extension bundle (shared source, separate build)

### Extension Directory Structure

```
extension/
├── manifest.json
├── vite.config.ts
├── src/
│   ├── background/
│   │   └── service-worker.ts   ← bookmark listener, message hub
│   ├── popup/
│   │   ├── Popup.tsx           ← main popup UI
│   │   ├── AddSiteFlow.tsx     ← one-click add with auto-classify
│   │   └── SyncStatus.tsx      ← sync state indicator
│   ├── shared/                 ← symlinked to ../src/lib/ or copied at build
│   │   ├── domainMap.ts
│   │   ├── classifySite.ts
│   │   └── normalizeUrl.ts
│   └── firebase/
│       └── index.ts            ← same firebaseConfig, Firebase SDK init
```

### Extension `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "Foyer",
  "version": "1.0.0",
  "description": "Your personal home for the web",
  "permissions": [
    "bookmarks",
    "storage",
    "identity"
  ],
  "host_permissions": [
    "https://*.firebaseio.com/*",
    "https://firestore.googleapis.com/*",
    "https://identitytoolkit.googleapis.com/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "action": {
    "default_popup": "popup/index.html",
    "default_icon": "icons/icon48.png"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### Feature 1: Intercept Native ★ Bookmark Button

When a user clicks the browser's native bookmark star, Chrome fires `chrome.bookmarks.onCreated`. The extension's service worker listens to this and silently mirrors it to Foyer:

```typescript
// background/service-worker.ts
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  if (!bookmark.url) return;  // folder creation, ignore
  
  const user = await getAuthenticatedUser();
  if (!user) return;  // not logged in to Foyer, skip
  
  const categories = await getCategoriesFromFirestore(user.uid);
  const result = classifySite(bookmark.title || "", bookmark.url, categories);
  
  if (result.confidence === "high") {
    // Silent auto-add: high confidence = no confirmation needed
    await addSiteToFirestore(user.uid, {
      name: bookmark.title,
      url: bookmark.url,
      domain: getRootDomain(bookmark.url),
      categoryId: result.categoryId,
    });
    // Show a subtle notification badge on extension icon
    showSuccessNotification(`Added to ${getCategoryName(result.categoryId, categories)}`);
  } else {
    // Show popup for user to confirm/override category
    showPopupForConfirmation({ bookmark, classificationResult: result });
  }
});
```

**Behavior matrix:**

| Confidence | Action |
|---|---|
| **High** | Silently add to detected category. Badge notification: "Added to Social Media" |
| **Medium** | Extension popup opens: "Added to Foyer — confirm category?" with dropdown pre-filled |
| **Low / None** | Extension popup opens: "Added to Foyer — pick a category" with all categories listed |

### Feature 2: Extension Popup UI

Opens when user clicks the Foyer icon in the toolbar.

**States:**

**Logged out:**
- Shows "Sign in to Foyer" button → opens Firebase OAuth popup

**Logged in — on a regular page:**
- Shows current page title + URL
- "Add this page to Foyer" button → runs classifier → shows category selector → Add button
- Auto-fill: category pre-selected based on classifier, user can override
- Recent additions list (last 5)

**Logged in — just bookmarked something (redirected from service worker):**
- Shows: "You just bookmarked: [Title]" 
- Category dropdown (pre-filled from classifier)
- [Add to Foyer] [Skip] buttons

### Feature 3: Initial Sync on First Install

When the extension installs and user logs in for the first time:

```typescript
chrome.runtime.onInstalled.addListener(async () => {
  const user = await getAuthenticatedUser();
  if (!user) return;
  
  const settings = await getSettingsFromFirestore(user.uid);
  if (settings.extensionLinked) return;  // already done this
  
  // Read ALL existing browser bookmarks
  const bookmarks = await chrome.bookmarks.getTree();
  const flat = flattenBookmarkTree(bookmarks);
  
  // Classify each one
  const categories = await getCategoriesFromFirestore(user.uid);
  const classified = flat.map(b => ({
    ...b,
    classification: classifySite(b.title, b.url, categories, b.folder),
  }));
  
  // Save pending import to Firestore for web app to pick up
  await setPendingImport(user.uid, classified);
  
  // Mark extension as linked
  await updateSettings(user.uid, { 
    extensionLinked: true,
    lastExtensionSync: Date.now(),
  });
  
  // Open web app with import review URL
  chrome.tabs.create({ url: "https://foyer.app/?extensionImport=true" });
});
```

The web app detects `?extensionImport=true` on load, reads the pending import from Firestore, and shows the standard **Step 2 Preview modal** with all bookmarks pre-classified.

### Feature 4: Ongoing Bookmark Sync

After initial setup, any new bookmark the user creates in the browser is automatically mirrored to Foyer (via `chrome.bookmarks.onCreated`). Deletions are **not** mirrored by default — Foyer is not a direct mirror; it's a curated collection. User can enable "mirror deletions" in extension settings if they want 1:1 sync.

### Feature 5: Cross-Device & Cross-Browser Sync

Because both extension and web app write to the **same Firestore document**, sync across devices is automatic:

```
Device A (Chrome, extension installed)
  → User bookmarks github.com
  → Extension catches onCreated
  → Writes to Firestore: users/{uid}/categories/development/websites/...

Device B (Firefox, web app only)
  → Foyer web app has a Firestore real-time listener
  → New site appears in Development category within ~1 second
  → No extension needed on Device B

Device C (Mobile, Chrome, extension installed)
  → Extension also listens to onCreated
  → Dedup: normalizeUrl() check before writing prevents double-adds
```

The `normalizeUrl` dedup check runs before every write — whether from extension or web app.

---

## Data Model Extensions

Add to Firestore `users/{uid}` settings document:

```typescript
interface UserSettings {
  // existing fields...
  wallpaperEnabled: boolean;
  selectedSearchEngine: string;
  
  // new fields for bookmark features
  bookmarkImportPromptShown: boolean;   // controls first-login popup
  extensionLinked: boolean;             // extension initial sync done
  lastExtensionSync: number;            // timestamp
  extensionSyncEnabled: boolean;        // user can turn off auto-sync
  mirrorDeletions: boolean;             // sync deletions (default false)
}
```

Pending extension import stored temporarily:

```
users/{uid}/pendingExtensionImport (document)
  bookmarks: ParsedBookmark[]   ← written by extension, read+deleted by web app
  createdAt: timestamp
```

---

## Files Summary

### Web App (`src/`)

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/domainMap.ts` | CREATE | 300+ domain → category name mappings |
| `src/lib/normalizeUrl.ts` | CREATE | URL normalization for dedup |
| `src/lib/bookmarkParser.ts` | CREATE | Netscape HTML parser |
| `src/lib/classifySite.ts` | CREATE | URL/name → best category classifier |
| `src/contexts/CategoriesContext.tsx` | MODIFY | Add `importBookmarks()` method |
| `src/app/page.tsx` | MODIFY | Import modal + first-login popup + auto-classify in add form + `?extensionImport` handler |
| `src/styles/css/modals.css` | MODIFY | Import preview table styles |
| `src/lib/types.ts` | MODIFY | Add new settings fields to `UserSettings` |

### Extension (`extension/`)

| File | Action | Purpose |
|------|--------|---------|
| `extension/manifest.json` | CREATE | MV3 manifest with bookmarks + identity permissions |
| `extension/src/background/service-worker.ts` | CREATE | `onCreated` listener, initial sync, message hub |
| `extension/src/popup/Popup.tsx` | CREATE | Toolbar popup UI |
| `extension/src/popup/AddSiteFlow.tsx` | CREATE | Add-to-Foyer confirmation UI |
| `extension/src/firebase/index.ts` | CREATE | Firebase init (same config) |
| `extension/src/shared/` | CREATE | Shared logic (domainMap, classifySite, normalizeUrl) |
| `extension/vite.config.ts` | CREATE | Vite build for MV3 |
| `extension/package.json` | CREATE | Extension dependencies |

---

## Implementation Phases

### Phase 1 — Core Classifier (Web App only, no extension)
Build `domainMap.ts`, `normalizeUrl.ts`, `classifySite.ts`. Wire auto-classify into the existing Add Site modal on URL blur. **Immediately useful, zero new UI.**

### Phase 2 — Bulk Import Modal (Web App)
Build `bookmarkParser.ts`. Build the 3-step import modal. Add first-login prompt. **Users can now import existing bookmarks.**

### Phase 3 — Extension Scaffold
Set up extension project with Vite, Firebase auth, popup UI. No bookmark features yet — just "Add this page to Foyer" button in popup. **Replaces the bookmarklet idea with a proper extension.**

### Phase 4 — Extension Bookmark Interception
Add `chrome.bookmarks.onCreated` listener. Wire classifier. Show confirmation popup for medium/low confidence. Silent auto-add for high confidence. **The core cross-device sync experience.**

### Phase 5 — Initial Sync & Cross-Device
Add `onInstalled` bulk sync: reads all bookmarks, writes `pendingExtensionImport` to Firestore. Web app reads it on `?extensionImport=true` and shows preview modal. **First install experience complete.**

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Classification approach | Domain mapping (algorithmic) | Instant, offline, zero cost, deterministic |
| Folder name as hint | Yes, primary signal after domain | Free, accurate — user already organized it |
| URL normalization | Yes, before every dedup check | Prevents `http`/`https`, `www.` duplicates |
| Confidence threshold for silent add | High only | Medium/low require user confirmation |
| Mirror deletions | Off by default, opt-in | Foyer is curated, not a mirror |
| Extension auth | Firebase SDK directly in extension | Same auth system, no separate backend |
| Pending import channel | Firestore `pendingExtensionImport` doc | Extension → web app handoff without polling |
| Cross-device sync mechanism | Firestore real-time listeners (web) + onCreated (extension) | No custom sync server needed |
| Extension manifest version | MV3 | Required for Chrome Web Store; Firefox compatible |
| Auto-add confidence: High | Silent, notification badge | Low friction for obvious sites |
| Auto-add confidence: Medium/Low | Popup confirmation | Prevents mis-categorization |
| AI/ML | Not used | Domain map covers 95%+ of cases; AI adds latency + cost |
