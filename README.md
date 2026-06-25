# Foyer

A fully customizable personal browser homepage (new-tab replacement) built with Next.js 15, Firebase, and TypeScript. Features a drag-and-drop shortcut grid, a unified search widget, and Unsplash wallpaper integration.

## Features

- **Cloud Sync & Auth** — Firebase Authentication (Email/Password + Google Sign-In). Categories and shortcuts sync across devices via Cloud Firestore.
- **Custom Shortcuts** — Organize websites into categories with a 5-level fallback chain for high-quality favicons.
- **Drag & Drop** — Native HTML5 drag-and-drop to reorder shortcuts and entire category sections.
- **Unified Search** — Search across Google, YouTube, Perplexity, X, Reddit, and Wikipedia. Saves per-engine search history locally.
- **Dynamic Wallpapers** — Integrates with the Unsplash API for beautiful rotating background imagery based on configurable keywords.
- **Unsplash Account Linking** — Secure OAuth 2.0 to connect your Unsplash account. Click the heart button to save wallpapers to a "Foyer" collection on your profile.
- **Data Portability** — Export and import your entire setup as a JSON file.
- **Right-click & Long-press Menus** — Desktop right-click and mobile long-press for edit/delete actions.

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **State:** React Context (CategoriesContext), localStorage-first with Firestore sync
- **Backend / BaaS:** Firebase v10 (Auth, Firestore)
- **API Routes:** Next.js API route for Unsplash OAuth token exchange (server-side, secret stays hidden)
- **Styling:** Modular CSS (variables, glassmorphism, animations)
- **Deployment:** Vercel (static + serverless functions)
- **Dependencies:** `firebase`, `@fortawesome/fontawesome-free`, `@next/font`

## Architecture

```
src/
├── app/
│   ├── page.tsx                    Main dashboard (UI shell + imperative wiring)
│   ├── login/page.tsx              Auth screen
│   ├── unsplash-callback/page.tsx  OAuth redirect handler
│   ├── not-found.tsx               404 page
│   └── api/unsplash-exchange/      Server-side token exchange
├── components/
│   ├── AuthGuard.tsx               Auth wrapper with avatar fallback
│   ├── CategorySection.tsx         Section header + grid wrapper
│   ├── ShortcutCard.tsx            Favicon fallback + context menu
│   └── ShortcutGrid.tsx            Grid container with DnD wiring
├── contexts/
│   └── CategoriesContext.tsx       CRUD with localStorage → Firestore sync
├── hooks/
│   ├── useUnsplash.ts              OAuth, connection state, photo liking
│   └── useWallpaper.ts             Keyword rotation, photo application
├── lib/
│   ├── firebase.ts                 Firebase SDK init
│   ├── schema.ts                   TypeScript types
│   ├── constants.ts                Default config values
│   ├── defaults.ts                 Default categories
│   ├── utils.ts                    Utility functions
│   └── toast.ts                    Shared toast notification
└── styles/
    └── css/                        Modular CSS files (6 stylesheets)
```

## Database Schema (Firestore)

```
users/{userId}
  ├── email: string
  ├── displayName: string
  ├── photoURL: string
  ├── settings: { wallpaperEnabled, lastWallpaperKeyword, selectedSearchEngine }
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

## Local Setup

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/foyer.git
cd foyer
npm install
```

### 2. Firebase Configuration

1. Go to the [Firebase Console](https://console.firebase.google.com) and create a project (Spark Plan).
2. Enable **Authentication** (Google + Email/Password).
3. Enable **Firestore Database** with user-scoped security rules.
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

### 3. Unsplash Configuration

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

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

Deploy to Vercel with zero config:

```bash
npx vercel --prod
```

Set all environment variables from `.env.local` in the Vercel dashboard (for `UNSPLASH_CLIENT_SECRET`, use the "Environment Variables" section — it stays server-side).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run Next.js lint |
| `npm run typecheck` | Run TypeScript type check |
