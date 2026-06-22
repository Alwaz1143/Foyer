// ============================================
// FIREBASE AUTH GUARD — index.html
// ============================================

import {
    auth, db,
    onAuthStateChanged, signOut,
    doc, getDoc, setDoc, deleteDoc,
    collection, getDocs, writeBatch
} from './firebase-config.js';

// ── Unsplash OAuth Config ─────────────────────────────────────────────────────
// Read from config.js (window.FOYER_CONFIG). The Unsplash OAuth client_id
// is the Access Key (same key used for wallpaper fetching in UNSPLASH_CONFIG).
const UNSPLASH_CLIENT_ID = window.FOYER_CONFIG?.unsplash?.accessKey || '';
const UNSPLASH_REDIRECT_URI = window.FOYER_CONFIG?.unsplash?.redirectUri || `${window.location.origin}/unsplash-callback.html`;


// Expose Firestore db and functions as globals so regular script.js can use them
window.fs = { db, doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch };

// ── Auth State ────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Not signed in — redirect to login
        window.location.replace('login.html');
        return;
    }

    // Signed in ✓
    window.currentUser = user;

    // Reveal the page (was hidden to prevent flash of unauthenticated content)
    document.body.style.visibility = 'visible';

    // Populate user avatar UI
    setupUserAvatar(user);

    // Wire up user menu interactions
    setupUserMenu();

    // Signal script.js to begin initializing
    document.dispatchEvent(new CustomEvent('foyer-auth-ready', { detail: { user } }));
});

// ── User Avatar ───────────────────────────────────────────────────────────────
function setupUserAvatar(user) {
    const avatarImg       = document.getElementById('userAvatarImg');
    const avatarInitials  = document.getElementById('userAvatarInitials');
    const menuName        = document.getElementById('userMenuName');
    const menuEmail       = document.getElementById('userMenuEmail');

    if (user.photoURL && avatarImg) {
        avatarImg.src              = user.photoURL;
        avatarImg.style.display    = 'block';
        if (avatarInitials) avatarInitials.style.display = 'none';
    } else if (avatarInitials) {
        if (avatarImg) avatarImg.style.display = 'none';
        avatarInitials.style.display = 'flex';
        const seed = user.displayName || user.email || 'U';
        avatarInitials.textContent = seed.charAt(0).toUpperCase();
    }

    if (menuName)  menuName.textContent  = user.displayName || user.email || 'User';
    if (menuEmail) menuEmail.textContent = user.email || '';
}

// ── User Menu ─────────────────────────────────────────────────────────────────
function setupUserMenu() {
    const avatarBtn      = document.getElementById('userAvatarBtn');
    const userMenu       = document.getElementById('userMenu');
    const signOutBtn     = document.getElementById('signOutBtn');
    const unsplashBtn    = document.getElementById('unsplashConnectBtn');

    if (avatarBtn && userMenu) {
        avatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!avatarBtn.contains(e.target) && !userMenu.contains(e.target)) {
                userMenu.classList.remove('show');
            }
        });
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            signOut(auth)
                .then(() => window.location.replace('login.html'))
                .catch(console.error);
        });
    }

    // Connect Unsplash button
    if (unsplashBtn) {
        unsplashBtn.addEventListener('click', () => {
            userMenu.classList.remove('show');
            startUnsplashOAuth();
        });
    }

    // Load Unsplash connection state and update the menu label
    loadUnsplashMenuState();
}

// ── Unsplash OAuth ────────────────────────────────────────────────────────────
function startUnsplashOAuth() {
    if (!UNSPLASH_CLIENT_ID || UNSPLASH_CLIENT_ID === 'YOUR_UNSPLASH_CLIENT_ID') {
        alert('Unsplash is not configured yet. Ask your Foyer admin to set the Unsplash Client ID.');
        return;
    }
    const redirectUri = encodeURIComponent(UNSPLASH_REDIRECT_URI);
    const scopes      = encodeURIComponent('public write_likes write_collections');
    const authUrl     = `https://unsplash.com/oauth/authorize?client_id=${UNSPLASH_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}`;
    window.location.href = authUrl;
}

// Expose startUnsplashOAuth so script.js can call it from the popup button
window.startUnsplashOAuth = startUnsplashOAuth;

async function loadUnsplashMenuState() {
    const btn = document.getElementById('unsplashConnectBtn');
    if (!btn || !window.currentUser) return;
    try {
        const snap = await getDoc(doc(db, 'users', window.currentUser.uid));
        if (snap.exists() && snap.data().unsplash?.accessToken) {
            const username = snap.data().unsplash.username;
            btn.innerHTML = `<i class="fas fa-check-circle" style="color:#22c55e"></i><span>Unsplash: @${username}</span>`;
            btn.disabled = true;
        }
    } catch (e) { /* silent */ }
}
