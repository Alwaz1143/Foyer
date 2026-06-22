// ============================================
// FOYER — App Configuration Template
// ============================================
// Copy this file to config.js and fill in your real values.
// config.js is gitignored — this file is safe to commit.

window.FOYER_CONFIG = {

    // ── Firebase ────────────────────────────────────────────────────────────
    // Get from: Firebase Console → Project Settings → Your apps → Web app
    firebase: {
        apiKey:            "YOUR_FIREBASE_API_KEY",
        authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
        projectId:         "YOUR_PROJECT_ID",
        storageBucket:     "YOUR_PROJECT_ID.firebasestorage.app",
        messagingSenderId: "YOUR_SENDER_ID",
        appId:             "YOUR_APP_ID",
        measurementId:     "YOUR_MEASUREMENT_ID"   // optional (Analytics)
    },

    // ── Unsplash ─────────────────────────────────────────────────────────────
    // Get from: https://unsplash.com/developers → Your App → Keys
    // "Access Key" = used for wallpaper fetching + OAuth client_id
    // "Secret Key" = stored ONLY in the Cloudflare Worker secret (never here)
    unsplash: {
        accessKey: "YOUR_UNSPLASH_ACCESS_KEY",
        redirectUri: "http://localhost:5000/unsplash-callback.html"
    }

};
