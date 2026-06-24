# Foyer 🚪

**Foyer** is a fully customizable, personal browser homepage (new-tab replacement) built with vanilla web technologies and backed by Firebase and Cloudflare. It features a drag-and-drop shortcut grid, a unified search widget, and seamless Unsplash integration to sync your favorite wallpapers directly to your Unsplash account.

---

## ✨ Features

* **☁️ Cloud Sync & Auth:** Firebase Authentication (Email/Password + Google Sign-In) ensures your setup syncs across all your devices in real-time via Cloud Firestore.
* **🗂️ Custom Shortcuts:** Organize your most-used websites into categories. Features a 5-level fallback chain for high-quality favicons.
* **🖱️ Drag & Drop:** Native HTML5 drag-and-drop to reorder individual shortcut cards or entire category sections.
* **🔍 Unified Search:** Search across Google, YouTube, Perplexity, X, Reddit, and Wikipedia from a single widget. Saves per-engine search history locally.
* **🖼️ Dynamic Wallpapers:** Integrates with the Unsplash API for beautiful, rotating background imagery based on dynamic keywords.
* **❤️ Unsplash Account Linking:** Secure OAuth 2.0 integration allows you to connect your personal Unsplash account. Clicking the ♥ button automatically creates a "Foyer" collection on your profile and saves the current wallpaper.
* **💾 Data Portability:** Export your entire setup as a JSON file and import it anywhere as a backup.

---

## 🛠️ Tech Stack

* **Frontend:** Vanilla JavaScript (ES Modules), HTML5, CSS3 (Glassmorphism design system).
* **Backend / BaaS:** Firebase v10 (Auth, Firestore, Hosting).
* **Edge Proxy:** Cloudflare Workers (Handles Unsplash OAuth token exchange securely, keeping the API secret hidden from the browser).

---

## 🏗️ Architecture & File Structure

| Directory / File | Purpose |
| --- | --- |
| `index.html` | The main single-page application and UI shell. |
| `login.html` | Authentication screen (Email/Password & Google Sign-In). |
| `unsplash-callback.html` | Handles the OAuth redirect from Unsplash and communicates with the Worker. |
| `script.js` | Core business logic (UI rendering, Drag & Drop, Search, Firestore sync). |
| `firebase-config.js` | Initializes the Firebase v10 SDK using credentials from `config.js`. |
| `firebase-auth-guard.js` | Route protection, ensuring only authenticated users can view the dashboard. |
| `css/` | Modular CSS (variables, base, wallpaper, widgets, shortcuts, modals, animations, responsive). |
| `cloudflare-worker/` | Contains `worker.js` for the Cloudflare Edge server handling Unsplash OAuth. |

---

## 🗄️ Database Schema (Firestore)

Foyer utilizes a NoSQL document/collection hierarchy to minimize read/write costs and ensure fast loading.

```text
users/{userId}
  ├── email: string
  ├── displayName: string
  ├── photoURL: string
  ├── settings: {
  │     wallpaperEnabled: boolean,
  │     lastWallpaperKeyword: string,
  │     selectedSearchEngine: string
  │   }
  └── unsplash: {
        accessToken: string,
        username: string,
        foyerCollectionId: string
      }

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

## 🚀 Local Setup & Deployment

### 1. Repository Setup

1. Clone the repository: `git clone https://github.com/yourusername/foyer.git`
2. Navigate to the project directory: `cd foyer`
3. Duplicate `config.example.js` and rename it to `config.js`.

### 2. Firebase Configuration

1. Go to the [Firebase Console](https://console.firebase.google.com) and create a free project (Spark Plan).
2. Enable **Authentication** (Google & Email/Password providers).
3. Enable **Firestore Database** and update the security rules to ensure users can only read/write their own data.
4. Copy your Firebase Web App configuration into `config.js`.

### 3. Unsplash & Cloudflare Worker Setup

Because single-page applications cannot safely store API secrets, Foyer uses a Cloudflare Worker to handle the OAuth token exchange.

1. Create an app in the [Unsplash Developer Portal](https://unsplash.com/developers) and enable the `public`, `write_likes`, and `write_collections` scopes.
2. Add your Unsplash **Access Key** to `config.js`.
3. Open your terminal and navigate to the worker directory: `cd cloudflare-worker`
4. Log into Cloudflare: `npx wrangler login`
5. Securely store your Unsplash keys in the worker's environment:
* `npx wrangler secret put UNSPLASH_CLIENT_ID` (Paste Access Key)
* `npx wrangler secret put UNSPLASH_CLIENT_SECRET` (Paste Secret Key)


6. Deploy the worker: `npx wrangler deploy`
7. Copy the resulting `*.workers.dev` URL and update the `WORKER_URL` variable inside `unsplash-callback.html`.

### 4. Run Locally

Serve the root directory using any local development server (e.g., VS Code Live Server, Python `http.server`, or Node `http-server`).

* **Note:** Ensure your local development port matches the `redirectUri` configured in your Unsplash Developer dashboard (e.g., `http://127.0.0.1:5500/unsplash-callback.html`).

<!-- ---------------------------------------------------------------------------------------------------------------------------------------------------- -->