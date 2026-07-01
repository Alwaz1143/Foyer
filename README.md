# Foyer

A customizable browser startpage (new-tab replacement) with a companion Chrome/Brave extension for cross-device bookmark sync.

**Web App** — Next.js 15, React 19, Firebase, TypeScript
**Extension** — WXT (Chrome MV3), React 19, Firebase

---

## Features

### Web App

- **Cloud Sync & Auth** — Firebase Authentication (Email/Password + Google Sign-In). Categories and shortcuts sync across devices via Cloud Firestore.
- **Custom Shortcuts** — Organize websites into draggable sections with a 5-level favicon fallback chain (Google → Clearbit → DuckDuckGo → Favicon Kit → origin).
- **Drag & Drop** — Reorder shortcuts within/between sections and reorder entire sections.
- **Unified Search** — 8 search engines (Google, YouTube, Perplexity, ChatGPT, Claude, Gemini, X, Reddit, Wikipedia). Saves per-engine search history locally.
- **Google AI Mode** — Toggle the sparkle icon (⋆) in the search input to enable Google's AI Overviews mode (`&udm=50`). State persisted to localStorage and synced to Firestore.
- **Dynamic Wallpapers** — Unsplash API integration with configurable keyword rotation.
- **Unsplash Account Linking** — OAuth 2.0 to connect your Unsplash account. Heart button saves wallpapers to a "Foyer" collection.
- **Data Portability** — Export/import your entire setup as JSON.
- **Bookmark Import** — Upload a Netscape bookmark HTML file (exportable from any browser). Foyer auto-classifies each bookmark into the matching section using a 300+ domain→name map, with folder hint and keyword fallback tiers.
- **Auto-Detect on Add** — When adding a site, blur the URL field to auto-classify and select the right section with a confidence badge.
- **Section Collapse** — Sections with more than 12 apps show a "Show N more ↓" button for compact layout.
- **Right-click & Long-press** — Desktop right-click and mobile long-press for edit/delete actions.

### Extension

- **Add Current Page** — One-click to save the active tab to your Foyer dashboard.
- **Auto-Classify** — Every bookmark is classified into the right section using the same domain→name map as the web app.
- **★ Bookmark Auto-Sync** — Native bookmarking (★) any page wakes the service worker, classifies the URL, and writes to Firestore silently. A badge counter shows how many were auto-added.
- **Bulk Import** — Sync button imports all existing browser bookmarks at once.
- **Cross-Device Sync** — Polls Firestore every 30s to pick up changes made from other devices.
- **Offline Queue** — Bookmarks created before sign-in are queued and flushed automatically on auth.

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| **Framework** | Next.js 15 (App Router), React 19 |
| **Language** | TypeScript (strict mode) |
| **Auth & DB** | Firebase v10 — Authentication (Email/Password + Google), Cloud Firestore |
| **Search Icons** | Font Awesome 6.7.2 (npm), custom SVG icons for Perplexity, ChatGPT, Claude, Gemini |
| **Styling** | Modular CSS (glassmorphism, CSS custom properties, keyframe animations, responsive breakpoints) |
| **Extension Build** | WXT 0.19 (Chrome MV3, Vite 6 under the hood) |
| **Unsplash** | OAuth 2.0 token exchange via Next.js API route (server-side secret) |
| **Deployment** | Vercel (static + serverless functions) |

---

## Architecture

```
foyer/
├── src/
│   ├── app/                          Web app pages + API routes
│   │   ├── page.tsx                  Main dashboard (search, modals, action bar)
│   │   ├── layout.tsx                Root layout (imports Font Awesome, context providers)
│   │   ├── login/page.tsx            Auth screen
│   │   ├── unsplash-callback/        OAuth redirect handler
│   │   ├── not-found.tsx             404 page
│   │   └── api/unsplash-exchange/    Server-side token exchange
│   ├── components/
│   │   ├── AuthGuard.tsx             Auth wrapper with avatar/user menu
│   │   ├── CategorySection.tsx       Section header + grid with expand/collapse
│   │   ├── ShortcutCard.tsx          Favicon fallback chain + context menu
│   │   └── ShortcutGrid.tsx          Grid container with full DnD wiring
│   ├── contexts/
│   │   ├── AuthContext.tsx           Firebase auth state (onAuthStateChanged)
│   │   └── CategoriesContext.tsx     CRUD with localStorage → Firestore sync
│   ├── hooks/
│   │   ├── useSearch.ts             Search widget: engines, history, AI mode toggle
│   │   ├── useFirestoreSync.ts      Debounced Firestore write + dedup pass
│   │   ├── useUnsplash.ts           OAuth flow, connection state, photo liking
│   │   └── useWallpaper.ts         Keyword rotation, photo application
│   ├── lib/
│   │   ├── firebase.ts              Firebase SDK init (singleton)
│   │   ├── types.ts                 All TypeScript interfaces
│   │   ├── constants.ts             Search engine definitions, defaults
│   │   ├── defaults.ts              Default categories (Social, Productivity, AI, etc.)
│   │   ├── utils.ts                 getRootDomain, generateSiteId, etc.
│   │   ├── storage.ts               foyerKey() helper for scoped localStorage
│   │   ├── toast.ts                 Toast notification system
│   │   ├── normalizeUrl.ts          URL normalization for deduplication
│   │   ├── domainMap.ts             300+ domain → category name mappings
│   │   ├── classifySite.ts          Tiered classifier: domain → folder → keyword → none
│   │   └── bookmarkParser.ts        Netscape HTML bookmark parser
│   └── styles/css/
│       ├── variables.css             CSS custom properties
│       ├── base.css                  Body, container, typography
│       ├── wallpaper.css             Wallpaper system + user menu
│       ├── categories.css            Section tiles, grid, expand/collapse toggle
│       ├── shortcuts.css             Icon cards, favicon chain, context menu
│       ├── widgets.css               Search widget, AI sparkle toggle, engine selector
│       ├── buttons.css               Action bar, section/site buttons
│       ├── modals.css                All modal dialogs + import table
│       ├── animations.css            Keyframe animations (fadeIn, shimmer, etc.)
│       ├── responsive.css            Breakpoints at 1400, 768, 480
│       └── accessibility.css         Focus styles
│
├── extension/
│   ├── wxt.config.ts                Chrome MV3 config (bookmarks, storage, tabs)
│   ├── tsconfig.json                 TypeScript config (bundler resolution, strict)
│   ├── package.json                  React 19, Firebase 10, WXT 0.19
│   ├── entrypoints/
│   │   ├── background.ts            Service worker — all 4 phases
│   │   └── popup/
│   │       ├── index.html            Popup shell
│   │       ├── main.tsx              React entry
│   │       ├── App.tsx               Auth form + tab preview + action buttons
│   │       └── styles.css            Popup styling
│   ├── lib/
│   │   ├── firebase.ts              Firebase init (shared with web app config)
│   │   ├── auth.ts                  Email/Password sign in + onUserChanged
│   │   └── firestore.ts             Firestore CRUD helpers
│   ├── shared/                      Copied from web app (kept in sync manually)
│   │   ├── types.ts
│   │   ├── domainMap.ts
│   │   ├── classifySite.ts
│   │   ├── normalizeUrl.ts
│   │   └── utils.ts
│   ├── public/icons/                Source SVG + generated 16/48/128 PNG
│   └── scripts/
│       └── generate-icons.mjs       Sharp-based PNG generator
│
├── .env.example                     Environment template
├── next.config.ts                   Next.js config
└── tsconfig.json                    Strict TypeScript, @/ path alias
```

---

## Database Schema (Firestore)

```
users/{userId}
  ├── email: string
  ├── displayName: string
  ├── photoURL: string
  ├── settings: { wallpaperEnabled, selectedSearchEngine, lastWallpaperKeyword, googleAiMode }
  └── unsplash: { accessToken, username, foyerCollectionId }

users/{userId}/categories/{categoryId}
  ├── name: string
  ├── icon: string
  └── orderIndex: number

users/{userId}/categories/{categoryId}/websites/{websiteId}
  ├── name: string
  ├── url: string
  ├── domain: string
  ├── customIcon: string
  └── orderIndex: number
```

---

## Local Setup

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/foyer.git
cd foyer
npm install
```

### 2. Firebase Configuration

1. Go to the [Firebase Console](https://console.firebase.google.com) and create a project (Spark Plan).
2. Enable **Authentication** → Sign-in method → Email/Password + Google.
3. Enable **Firestore Database** in production mode. Deploy with user-scoped security rules (only authenticated users can read/write their own data).
4. Create a `.env.local` file with your Firebase Web App config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

### 3. Unsplash Configuration (Optional — for Wallpapers)

1. Create an app in the [Unsplash Developer Portal](https://unsplash.com/developers) with `public`, `write_likes`, and `write_collections` scopes.
2. Add to `.env.local`:

```env
NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=...
UNSPLASH_CLIENT_SECRET=...
```

3. Add these redirect URIs to your Unsplash app:
   - `http://localhost:3000/unsplash-callback`
   - `http://127.0.0.1:3000/unsplash-callback`
   - `https://yourdomain.com/unsplash-callback`

### 4. Run Web App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Extension Setup

### 1. Build

```bash
npm run ext:build
```

Output goes to `extension/.output/chrome-mv3/`.

### 2. Load in Browser

**Brave / Chrome:**
1. Open `brave://extensions` (or `chrome://extensions`)
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select `extension/.output/chrome-mv3/`

### 3. Sign In

The extension uses Email/Password auth tied to the same Firebase project.

**If you already have a Google account:**
1. Open the Foyer web app
2. Click your profile avatar → **Sign Out** (or skip this)
3. Go to Firebase Console → Authentication → find your user → ⋮ → **Reset password**
4. Check your email, set a password
5. Open the extension → enter email + new password → **Sign In**

**New user:**
1. Open the extension → click **Create account**
2. Enter email + password → done

### 4. First Sync

Click the sync button (↻) in the extension popup to import all existing browser bookmarks.

After that, every ★ bookmark you create is automatically classified and added to your Foyer dashboard in real time.

---

## Using the Bookmark Import (Web App)

1. Export your bookmarks as HTML from your browser:
   - **Chrome/Brave:** `chrome://bookmarks` → ⋮ → Export bookmarks
   - **Firefox:** Library → Bookmarks → Import and Backup → Export Bookmarks to HTML
2. In Foyer, click **Bookmarks** in the action bar
3. Upload the HTML file
4. Review the preview table showing each bookmark's title, detected category, and confidence level
5. Check **"Skip bookmarks that already exist"** (recommended)
6. Check **"Create new sections for unmatched domains"** to auto-create sections for domains not in your current setup
7. Click **Import**

The domain→category map covers 300+ domains across 12 categories (Social Media, Productivity, AI, Development, Design, Entertainment, News, Sports, Games, Shopping, Education, Finance). Unmatched bookmarks are reported so you can categorize them manually.

---

## Google AI Mode (Search)

1. Type a query in the search bar
2. Click the **sparkle icon (⋆)** on the right side of the input box — it toggles to filled (active)
3. Submit — your search goes to `google.com/search?q=...&udm=50` (AI Overviews mode)
4. Toggle state is saved to localStorage and synced to Firestore so it persists across devices

---

## Extension Distribution (No Store)

Since the extension isn't published to the Chrome Web Store, distribute the zip:

```bash
cd extension
npx wxt zip
# Creates: extension/.output/foyer-extension-1.0.0-chrome.zip
```

Recipients:
1. Unzip the file
2. Brave/Chrome → `brave://extensions` → Developer mode → **Load unpacked** → select the folder
3. Sign in with their Foyer account

To update after rebuilding, just refresh the extension card in `brave://extensions`.

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start web app dev server |
| `npm run build` | Production build (web) |
| `npm run start` | Start production server |
| `npm run lint` | Run Next.js lint |
| `npm run typecheck` | TypeScript type check (web + extension via separate tsconfig) |
| `npm run ext:dev` | Start WXT dev server with HMR |
| `npm run ext:build` | Build extension for production |
| `npm run ext:icons` | Regenerate PNG icons from source SVG |

---

## Deployment

### Web App

Deploy to Vercel:

```bash
npx vercel --prod
```

Set all environment variables from `.env.local` in the Vercel dashboard (`UNSPLASH_CLIENT_SECRET` should be marked as sensitive).

### Extension

No deployment needed — load unpacked or distribute the zip file as described above.
