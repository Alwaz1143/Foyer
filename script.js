// ========================================
// GIST SYNC CONFIGURATION
// ========================================
// To enable cloud sync via GitHub Gist:
// 1. Set enabled to true
// 2. Add your GitHub Personal Access Token (with 'gist' scope)
// 3. Add your Gist ID
// Get token at: https://github.com/settings/tokens

const GIST_CONFIG = {
    enabled: false,
    token: '',
    gistId: '',
    filename: 'homepage-data.json',
    autoSyncDelay: 2000
};

// ========================================
// FIRESTORE SYNC STATE
// ========================================
// Tracks which IDs have been written to Firestore so we can
// efficiently delete removed categories/websites on next sync.
let knownFirestoreCategoryIds = new Set();
let knownFirestoreWebsiteIds = new Map(); // categoryId -> Set<websiteId>
let firestoreSyncTimeout = null;
let isFirstLoad = true;

// ========================================
// UNSPLASH WALLPAPER CONFIGURATION
// ========================================
// Access Key is loaded from config.js (window.FOYER_CONFIG) — not hardcoded here.
const UNSPLASH_CONFIG = {
    accessKey: window.FOYER_CONFIG?.unsplash?.accessKey || '', // set in config.js
    // query: 'nature,landscape,minimal', // Search query for random photos
    query: 'Mountains, Ocean waves, Forest fog, Sunset sky, Aurora lights, Minimalist black, Geometric patterns, Gradient blue, Neon glow, Vaporwave aesthetic, Cyberpunk city, Space nebula, Gaming setup, Dark mode, Futuristic grid', // Search query for random photos
    orientation: 'landscape' // landscape, portrait, or squarish
};

// Variable to hold user's custom keywords (defaults to config string)
let customWallpaperKeywords = UNSPLASH_CONFIG.query;

// ========================================
// SHORTCUT MENU SYSTEM
// ========================================

// Toggle shortcut menu dropdown
function toggleShortcutMenu(shortcutElement, menuDropdown, menuBtn) {
    const isOpen = menuDropdown.classList.contains('show');

    // Close all other menus first
    closeAllMenus();

    // Toggle this menu
    if (!isOpen) {
        // Position the dropdown relative to the menu button
        const btnRect = menuBtn.getBoundingClientRect();
        menuDropdown.style.top = (btnRect.bottom + 4) + 'px';
        menuDropdown.style.left = (btnRect.right - menuDropdown.offsetWidth) + 'px';

        // Ensure it doesn't go off-screen
        const dropdownRect = menuDropdown.getBoundingClientRect();
        if (dropdownRect.left < 10) {
            menuDropdown.style.left = '10px';
        }
        if (dropdownRect.right > window.innerWidth - 10) {
            menuDropdown.style.left = (window.innerWidth - menuDropdown.offsetWidth - 10) + 'px';
        }

        menuDropdown.classList.add('show');
        shortcutElement.classList.add('menu-open');
    }
}

// Close all shortcut menus
function closeAllMenus() {
    document.querySelectorAll('.shortcut-menu-dropdown.show').forEach(menu => {
        menu.classList.remove('show');
    });
    document.querySelectorAll('.shortcut-item.menu-open').forEach(item => {
        item.classList.remove('menu-open');
    });
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.shortcut-menu-btn') && !e.target.closest('.shortcut-menu-dropdown')) {
        closeAllMenus();
    }
});

// ========================================
// WALLPAPER SYSTEM
// ========================================

let wallpaperEnabled = localStorage.getItem('wallpaperEnabled') !== 'false'; // Enabled by default
let lastWallpaperKeyword = localStorage.getItem('lastWallpaperKeyword') || '';
let currentUnsplashPhotoId = null;  // ID of the currently displayed Unsplash photo
let currentUnsplashPhotoUrl = null;  // Unsplash page URL for the current photo

// Get a random keyword different from the last one
function getRandomWallpaperKeyword() {
    const keywords = customWallpaperKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);

    if (keywords.length <= 1) {
        return keywords[0] || 'nature';
    }

    // Filter out the last used keyword
    const availableKeywords = keywords.filter(k => k.toLowerCase() !== lastWallpaperKeyword.toLowerCase());

    // Pick a random keyword from available ones
    const randomIndex = Math.floor(Math.random() * availableKeywords.length);
    const selectedKeyword = availableKeywords[randomIndex];

    // Store the selected keyword
    lastWallpaperKeyword = selectedKeyword;
    localStorage.setItem('lastWallpaperKeyword', selectedKeyword);

    return selectedKeyword;
}

async function fetchUnsplashWallpaper() {
    if (!UNSPLASH_CONFIG.accessKey || UNSPLASH_CONFIG.accessKey === 'YOUR_ACCESS_KEY_HERE') {
        console.warn('Unsplash API key not configured');
        return;
    }

    const wallpaperBg = document.getElementById('wallpaperBackground');
    const photoCredit = document.getElementById('photoCredit');
    const photographerLink = document.getElementById('photographerLink');
    const imageLink = document.getElementById('imageLink');

    if (!wallpaperBg) return;

    // Get a random keyword different from the last one
    const selectedKeyword = getRandomWallpaperKeyword();

    // Detect screen orientation - portrait for mobile, landscape for desktop
    const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

    try {
        const response = await fetch(
            `https://api.unsplash.com/photos/random?orientation=${orientation}&query=${encodeURIComponent(selectedKeyword)}`,
            {
                headers: {
                    'Authorization': `Client-ID ${UNSPLASH_CONFIG.accessKey}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Unsplash API error: ${response.status}`);
        }

        const data = await response.json();

        // Preload the image
        const img = new Image();
        img.onload = () => {
            wallpaperBg.style.backgroundImage = `url(${data.urls.regular})`;
            wallpaperBg.classList.add('loaded');
            document.body.classList.add('wallpaper-active');

            // Show photographer credit (required by Unsplash)
            if (photographerLink && photoCredit) {
                photographerLink.textContent = data.user.name;
                photographerLink.href = `${data.user.links.html}?utm_source=homepage&utm_medium=referral`;
                photoCredit.classList.add('visible');
            }
            // Set heart icon link to the image on Unsplash
            if (imageLink) {
                const photoUrl = `${data.links.html}?utm_source=foyer&utm_medium=referral`;
                imageLink.href = photoUrl;
                currentUnsplashPhotoId = data.id;
                currentUnsplashPhotoUrl = photoUrl;

                imageLink.classList.remove('heart-liked');
            }
        };
        img.onerror = () => {
            console.error('Failed to load wallpaper image');
        };
        img.src = data.urls.regular;

    } catch (error) {
        console.error('Failed to fetch Unsplash wallpaper:', error);
    }
}

function disableWallpaper() {
    const wallpaperBg = document.getElementById('wallpaperBackground');
    const photoCredit = document.getElementById('photoCredit');

    if (wallpaperBg) {
        wallpaperBg.classList.remove('loaded');
        wallpaperBg.style.backgroundImage = '';
    }
    if (photoCredit) {
        photoCredit.classList.remove('visible');
    }
    document.body.classList.remove('wallpaper-active');
}

function toggleWallpaper() {
    const wallpaperToggle = document.getElementById('wallpaperToggle');

    if (!wallpaperEnabled) {
        // Wallpaper was off — turn it on
        wallpaperEnabled = true;
        localStorage.setItem('wallpaperEnabled', 'true');
        wallpaperToggle?.classList.remove('disabled');
        scheduleFirestoreSync();
    }

    // Always fetch a fresh wallpaper on click
    fetchUnsplashWallpaper();
}

function initWallpaper() {
    const wallpaperToggle = document.getElementById('wallpaperToggle');

    // Setup toggle button
    if (wallpaperToggle) {
        wallpaperToggle.addEventListener('click', toggleWallpaper);
        if (!wallpaperEnabled) {
            wallpaperToggle.classList.add('disabled');
        }
    }

    // Fetch wallpaper if enabled
    if (wallpaperEnabled) {
        fetchUnsplashWallpaper();
    }
}

// ========================================
// DEFAULT DATA
// ========================================

// Default website shortcuts data - categorized
// ========================================
// DEFAULT DATA
// ========================================

// Default website shortcuts data - categorized for a generic first collection
const defaultCategories = [
    {
        id: 'social',
        name: '🌐 Social Media',
        icon: '🌐',
        websites: [
            { name: 'X (Twitter)', url: 'https://twitter.com', domain: 'twitter.com' },
            { name: 'Instagram', url: 'https://www.instagram.com', domain: 'instagram.com' },
            { name: 'Reddit', url: 'https://www.reddit.com', domain: 'reddit.com' },
            { name: 'LinkedIn', url: 'https://www.linkedin.com', domain: 'linkedin.com' }
        ]
    },
    {
        id: 'productivity',
        name: '🎯 Productivity',
        icon: '🎯',
        websites: [
            { name: 'Notion', url: 'https://www.notion.so', domain: 'notion.so' },
            { name: 'Gmail', url: 'https://mail.google.com', domain: 'mail.google.com' },
            { name: 'Google Drive', url: 'https://drive.google.com', domain: 'drive.google.com' },
            { name: 'Trello', url: 'https://trello.com', domain: 'trello.com' }
        ]
    },
    {
        id: 'ai',
        name: '🤖 Artificial Intelligence',
        icon: '🤖',
        websites: [
            { name: 'ChatGPT', url: 'https://chat.openai.com', domain: 'openai.com' },
            { name: 'Perplexity', url: 'https://www.perplexity.ai', domain: 'perplexity.ai' },
            { name: 'Claude AI', url: 'https://claude.ai', domain: 'claude.ai' }
        ]
    },
    {
        id: 'sports',
        name: '⚽ Sports',
        icon: '⚽',
        websites: [
            { name: 'ESPN', url: 'https://www.espn.com', domain: 'espn.com' },
            { name: 'ESPNcricinfo', url: 'https://www.espncricinfo.com', domain: 'espncricinfo.com' },
            { name: 'Sky Sports', url: 'https://www.skysports.com', domain: 'skysports.com' }
        ]
    },
    {
        id: 'news',
        name: '📰 News & Media',
        icon: '📰',
        websites: [
            { name: 'BBC News', url: 'https://www.bbc.com/news', domain: 'bbc.com' },
            { name: 'Reuters', url: 'https://www.reuters.com', domain: 'reuters.com' },
            { name: 'The New York Times', url: 'https://www.nytimes.com', domain: 'nytimes.com' }
        ]
    },
    {
        id: 'entertainment',
        name: '🎬 Entertainment',
        icon: '🎬',
        websites: [
            { name: 'YouTube', url: 'https://www.youtube.com', domain: 'youtube.com' },
            { name: 'Spotify', url: 'https://www.spotify.com', domain: 'spotify.com' },
            { name: 'Netflix', url: 'https://www.netflix.com', domain: 'netflix.com' },
            { name: 'Twitch', url: 'https://www.twitch.tv', domain: 'twitch.tv' }
        ]
    },
    {
        id: 'games',
        name: '🎮 Games',
        icon: '🎮',
        websites: [
            { name: 'Chess.com', url: 'https://www.chess.com', domain: 'chess.com' },
            { name: 'Wordle', url: 'https://www.nytimes.com/games/wordle', domain: 'nytimes.com' },
            { name: 'Skribbl', url: 'https://skribbl.io', domain: 'skribbl.io' }
        ]
    }
];

// ── Category loading (Firestore-primary, localStorage fallback) ──────────────
let categories = [];

async function loadCategories() {
    if (window.fs && window.currentUser) {
        await loadCategoriesFromFirestore();
    } else {
        loadCategoriesFromLocalStorage();
    }
}

async function loadCategoriesFromFirestore() {
    const { db, collection, getDocs } = window.fs;
    const uid = window.currentUser.uid;

    try {
        const catsSnap = await getDocs(collection(db, 'users', uid, 'categories'));

        if (catsSnap.empty && isFirstLoad) {
            // First login — check localStorage for data to migrate, otherwise seed defaults
            const localData = localStorage.getItem('categories');
            if (localData) {
                try {
                    categories = JSON.parse(localData);
                    // Ensure every site has a stable ID
                    categories.forEach(cat => {
                        cat.websites.forEach(site => { if (!site.id) site.id = generateSiteId(); });
                    });
                    console.log('Foyer: Migrating localStorage data to Firestore...');
                } catch (e) {
                    categories = JSON.parse(JSON.stringify(defaultCategories));
                    categories.forEach(cat => cat.websites.forEach(s => { if (!s.id) s.id = generateSiteId(); }));
                }
            } else {
                categories = JSON.parse(JSON.stringify(defaultCategories));
                categories.forEach(cat => cat.websites.forEach(s => { if (!s.id) s.id = generateSiteId(); }));
            }
            await forceSyncToFirestore();
            localStorage.setItem('categories', JSON.stringify(categories));
            isFirstLoad = false;
            return;
        }

        // Build categories from Firestore docs (sort by orderIndex in memory)
        knownFirestoreCategoryIds = new Set();
        knownFirestoreWebsiteIds = new Map();
        categories = [];

        const sortedCatDocs = catsSnap.docs.sort((a, b) =>
            (a.data().orderIndex ?? 999) - (b.data().orderIndex ?? 999)
        );

        for (const catDoc of sortedCatDocs) {
            knownFirestoreCategoryIds.add(catDoc.id);

            const sitesSnap = await getDocs(collection(db, 'users', uid, 'categories', catDoc.id, 'websites'));
            const sortedSites = sitesSnap.docs.sort((a, b) =>
                (a.data().orderIndex ?? 999) - (b.data().orderIndex ?? 999)
            );

            knownFirestoreWebsiteIds.set(catDoc.id, new Set(sitesSnap.docs.map(s => s.id)));

            categories.push({
                id: catDoc.id,
                ...catDoc.data(),
                websites: sortedSites.map(s => ({ id: s.id, ...s.data() }))
            });
        }

        // Cache locally for offline fallback
        localStorage.setItem('categories', JSON.stringify(categories));
        isFirstLoad = false;

    } catch (err) {
        console.error('Foyer: Firestore load failed, falling back to localStorage:', err);
        loadCategoriesFromLocalStorage();
    }
}

function loadCategoriesFromLocalStorage() {
    const saved = localStorage.getItem('categories');
    if (saved) {
        categories = JSON.parse(saved);
        categories.forEach(cat => cat.websites.forEach(s => { if (!s.id) s.id = generateSiteId(); }));
    } else {
        const oldWebsites = localStorage.getItem('websites');
        if (oldWebsites) {
            migrateToCategories(JSON.parse(oldWebsites));
        } else {
            categories = JSON.parse(JSON.stringify(defaultCategories));
            categories.forEach(cat => cat.websites.forEach(s => { if (!s.id) s.id = generateSiteId(); }));
            localStorage.setItem('categories', JSON.stringify(categories));
        }
    }
}

function saveCategories() {
    // Write to localStorage immediately (instant UI, works offline)
    localStorage.setItem('categories', JSON.stringify(categories));
    // Schedule a debounced Firestore sync
    scheduleFirestoreSync();
}

// Migration function for existing users
function migrateToCategories(oldWebsites) {
    console.log('Migrating from flat structure to categories...');

    // Start with default categories
    categories = JSON.parse(JSON.stringify(defaultCategories));


    // Mapping of domains to category IDs for smart categorization
    const categoryMapping = {
        'twitter.com': 'social',
        'instagram.com': 'social',
        'reddit.com': 'social',
        'linkedin.com': 'social',
        'notion.so': 'productivity',
        'trello.com': 'productivity',
        'mail.google.com': 'productivity',
        'drive.google.com': 'productivity',
        'openai.com': 'ai',
        'perplexity.ai': 'ai',
        'claude.ai': 'ai',
        'espn.com': 'sports',
        'espncricinfo.com': 'sports',
        'skysports.com': 'sports',
        'bbc.com': 'news',
        'reuters.com': 'news',
        'nytimes.com': 'news',
        'youtube.com': 'entertainment',
        'spotify.com': 'entertainment',
        'netflix.com': 'entertainment',
        'twitch.tv': 'entertainment',
        'chess.com': 'games',
        'skribbl.io': 'games'
    };

    // Process old websites
    oldWebsites.forEach(site => {
        // Find matching category
        const categoryId = categoryMapping[site.domain] || 'productivity'; // Default to productivity
        const category = categories.find(cat => cat.id === categoryId);

        if (category) {
            // Check if site already exists (avoid duplicates)
            const exists = category.websites.some(w => w.domain === site.domain);
            if (!exists) {
                category.websites.push(site);
            }
        }
    });

    saveCategories();
    console.log('Migration complete!');
}

// Generate favicon URL with multiple fallback sources
function getFaviconUrl(domain) {
    // Google's favicon service - most reliable and widely compatible
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

// Extract clean root domain (e.g., https://www.example.com/path -> example.com)
function getRootDomain(input) {
    try {
        let hostname;
        // If input looks like a URL with protocol
        if (input.includes('://')) {
            const urlObj = new URL(input);
            hostname = urlObj.hostname;
        } else if (input.includes('/')) {
            // Has path but no protocol, add protocol temporarily
            const urlObj = new URL('https://' + input);
            hostname = urlObj.hostname;
        } else {
            // Just a hostname
            hostname = input;
        }

        // Remove www. prefix if present
        hostname = hostname.replace(/^www\./, '');

        // Extract root domain (e.g., mail.google.com -> google.com)
        const parts = hostname.split('.');
        if (parts.length > 2) {
            // Handle cases like co.uk, com.au, etc.
            return parts.slice(-2).join('.');
        }
        return hostname;
    } catch (e) {
        // If parsing fails, try simple extraction
        let cleaned = input.replace(/^(https?:\/\/)?(www\.)?/, '');
        cleaned = cleaned.split('/')[0]; // Remove path
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            return parts.slice(-2).join('.');
        }
        return cleaned;
    }
}

function getCategoryDisplayName(category) {
    if (!category) return '';
    let name = (category.name || '').trim();
    const icon = (category.icon || '').trim();

    if (icon && name) {
        // Remove icon from anywhere in the name string (start, middle, or end)
        // Escape special regex characters in the icon
        const escapedIcon = icon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        name = name.replace(new RegExp(escapedIcon, 'g'), '').trim();

        // Also remove common separators that might be left over
        name = name.replace(/^[-\s]+|[-\s]+$/g, '').trim();
    }

    return name || category.name || '';
}

function formatCategoryLabel(category) {
    const displayName = getCategoryDisplayName(category) || category.name || 'Untitled';
    const icon = (category.icon || '').trim();
    return icon ? `${icon} ${displayName}` : displayName;
}

function generateCategoryId(name) {
    const base = (name || 'section')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'section';
    const existingIds = new Set(categories.map(cat => cat.id));
    let uniqueId = base;
    let counter = 1;
    while (existingIds.has(uniqueId)) {
        uniqueId = `${base}-${counter}`;
        counter++;
    }
    return uniqueId;
}

// ========================================
// FIRESTORE SYNC FUNCTIONALITY
// ========================================

// Generate a stable unique ID for a website (UUID or fallback)
function generateSiteId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Debounce Firestore writes to avoid hammering the API on rapid changes
function scheduleFirestoreSync() {
    if (!window.fs || !window.currentUser) return;
    if (firestoreSyncTimeout) clearTimeout(firestoreSyncTimeout);
    firestoreSyncTimeout = setTimeout(() => syncToFirestore(), 2000);
}

// Force an immediate Firestore write (e.g. first-time seed)
async function forceSyncToFirestore() {
    if (firestoreSyncTimeout) { clearTimeout(firestoreSyncTimeout); firestoreSyncTimeout = null; }
    await syncToFirestore();
}

// Full Firestore sync: writes current categories/websites, deletes removed ones
async function syncToFirestore() {
    if (!window.fs || !window.currentUser) return;

    const { db, doc, setDoc, deleteDoc, collection, writeBatch } = window.fs;
    const uid = window.currentUser.uid;

    try {
        const batch = writeBatch(db);
        const currentCategoryIds = new Set(categories.map(c => c.id));

        // Delete categories that have been removed since last sync
        for (const oldCatId of knownFirestoreCategoryIds) {
            if (!currentCategoryIds.has(oldCatId)) {
                batch.delete(doc(db, 'users', uid, 'categories', oldCatId));
                // Also delete all websites in that category
                const oldSiteIds = knownFirestoreWebsiteIds.get(oldCatId) || new Set();
                for (const siteId of oldSiteIds) {
                    batch.delete(doc(db, 'users', uid, 'categories', oldCatId, 'websites', siteId));
                }
                knownFirestoreWebsiteIds.delete(oldCatId);
            }
        }

        // Write current categories and their websites
        categories.forEach((cat, catIndex) => {
            if (!cat.id) cat.id = generateSiteId();

            batch.set(doc(db, 'users', uid, 'categories', cat.id), {
                name: cat.name,
                icon: cat.icon || '',
                orderIndex: catIndex
            });

            const currentSiteIds = new Set();
            const knownSiteIds = knownFirestoreWebsiteIds.get(cat.id) || new Set();

            cat.websites.forEach((site, siteIndex) => {
                if (!site.id) site.id = generateSiteId();
                currentSiteIds.add(site.id);

                batch.set(doc(db, 'users', uid, 'categories', cat.id, 'websites', site.id), {
                    name: site.name,
                    url: site.url,
                    domain: site.domain,
                    customIcon: site.customIcon || '',
                    orderIndex: siteIndex
                });
            });

            // Delete websites removed from this category
            for (const oldSiteId of knownSiteIds) {
                if (!currentSiteIds.has(oldSiteId)) {
                    batch.delete(doc(db, 'users', uid, 'categories', cat.id, 'websites', oldSiteId));
                }
            }

            knownFirestoreWebsiteIds.set(cat.id, currentSiteIds);
        });

        // Write user settings alongside categories (single batch)
        batch.set(doc(db, 'users', uid), {
            email: window.currentUser.email || '',
            displayName: window.currentUser.displayName || '',
            photoURL: window.currentUser.photoURL || '',
            settings: {
                wallpaperEnabled: localStorage.getItem('wallpaperEnabled') !== 'false',
                selectedSearchEngine: localStorage.getItem('selectedSearchEngine') || 'google',
                lastWallpaperKeyword: localStorage.getItem('lastWallpaperKeyword') || '',
                customWallpaperKeywords: customWallpaperKeywords
            }
        }, { merge: true });

        await batch.commit();
        knownFirestoreCategoryIds = currentCategoryIds;
        console.log('Foyer: Firestore sync complete');

    } catch (err) {
        console.error('Foyer: Firestore sync failed:', err);
    }
}

// Load wallpaper + search engine preference from Firestore user doc
async function loadUserSettingsFromFirestore() {
    if (!window.fs || !window.currentUser) return;

    const { db, doc, getDoc } = window.fs;
    const uid = window.currentUser.uid;

    try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists() && snap.data().settings) {
            const s = snap.data().settings;
            if (s.wallpaperEnabled !== undefined) {
                wallpaperEnabled = s.wallpaperEnabled;
                localStorage.setItem('wallpaperEnabled', wallpaperEnabled);
            }
            if (s.selectedSearchEngine) {
                localStorage.setItem('selectedSearchEngine', s.selectedSearchEngine);
            }
            if (s.lastWallpaperKeyword) {
                lastWallpaperKeyword = s.lastWallpaperKeyword;
                localStorage.setItem('lastWallpaperKeyword', s.lastWallpaperKeyword);
            }
            if (s.customWallpaperKeywords) {
                customWallpaperKeywords = s.customWallpaperKeywords;
            }
        }
    } catch (err) {
        console.error('Foyer: Failed to load user settings from Firestore:', err);
    }
}

// No-op stubs (kept for backwards-compat with any callers in legacy code)
function scheduleAutoSync() { }
function showSyncStatus() { }

// ========================================
// UNSPLASH COLLECTION INTEGRATION
// ========================================

let unsplashAccessToken = null;
let foyerCollectionId = null;
let unsplashConnected = false;

// Load Unsplash state from Firestore on startup
async function loadUnsplashState() {
    if (!window.fs || !window.currentUser) return;
    const { db, doc, getDoc } = window.fs;
    try {
        const snap = await getDoc(doc(db, 'users', window.currentUser.uid));
        if (snap.exists() && snap.data().unsplash?.accessToken) {
            unsplashAccessToken = snap.data().unsplash.accessToken;
            foyerCollectionId = snap.data().unsplash.foyerCollectionId || null;
            unsplashConnected = true;
        }
    } catch (e) {
        console.warn('Foyer: Could not load Unsplash state:', e);
    }
}

// Wire up the ♥ button with the new behavior
function setupHeartButton() {
    const imageLink = document.getElementById('imageLink');
    const popup = document.getElementById('unsplashPopup');
    const connectPopupBtn = document.getElementById('connectUnsplashPopupBtn');
    const openBtn = document.getElementById('openInUnsplashBtn');

    if (!imageLink) return;

    imageLink.addEventListener('click', (e) => {
        e.preventDefault();

        if (unsplashConnected && currentUnsplashPhotoId) {
            // Connected — add to Foyer collection silently
            addToUnsplashCollection();
        } else if (currentUnsplashPhotoId) {
            // Not connected — toggle the popup
            popup.classList.toggle('show');
            // Keep the "Open in Unsplash" link in sync
            if (openBtn) openBtn.href = currentUnsplashPhotoUrl || imageLink.href;
        }
    });

    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
        if (popup && !imageLink.contains(e.target) && !popup.contains(e.target)) {
            popup.classList.remove('show');
        }
    });

    // Connect Unsplash from popup
    if (connectPopupBtn) {
        connectPopupBtn.addEventListener('click', () => {
            popup.classList.remove('show');
            if (window.startUnsplashOAuth) window.startUnsplashOAuth();
        });
    }
}

// Add the current wallpaper photo to the user's Foyer collection on Unsplash
async function addToUnsplashCollection() {
    if (!unsplashAccessToken || !currentUnsplashPhotoId) return;

    const imageLink = document.getElementById('imageLink');
    imageLink?.classList.add('heart-loading');

    try {
        // Create the collection if this is the first time
        if (!foyerCollectionId) {
            foyerCollectionId = await createFoyerCollection();
            if (!foyerCollectionId) throw new Error('Could not create collection');
        }

        // Add photo to collection
        const res = await fetch(`https://api.unsplash.com/collections/${foyerCollectionId}/add`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${unsplashAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ photo_id: currentUnsplashPhotoId })
        });

        if (res.ok || res.status === 422) {
            // 422 = already in collection — treat as success
            imageLink?.classList.add('heart-liked');
            showToast('Added to your Foyer collection on Unsplash \uD83D\uDC9B');
        } else {
            throw new Error(`API error ${res.status}`);
        }
    } catch (err) {
        console.error('Foyer: Failed to add to Unsplash collection:', err);
        showToast('Failed to add to collection', 'error');
    } finally {
        imageLink?.classList.remove('heart-loading');
    }
}

// Create a "Foyer" collection on the user's Unsplash account (called once)
async function createFoyerCollection() {
    try {
        const res = await fetch('https://api.unsplash.com/collections', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${unsplashAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: 'Foyer',
                description: 'Photos I loved while using Foyer — my personal browser homepage',
                private: false
            })
        });

        if (!res.ok) throw new Error(`Create collection failed: ${res.status}`);
        const col = await res.json();

        // Persist collection ID in Firestore so we don't recreate it next time
        if (window.fs && window.currentUser) {
            const { db, doc, setDoc } = window.fs;
            await setDoc(
                doc(db, 'users', window.currentUser.uid),
                { unsplash: { foyerCollectionId: col.id } },
                { merge: true }
            );
        }

        return col.id;
    } catch (err) {
        console.error('Foyer: Failed to create Foyer collection on Unsplash:', err);
        return null;
    }
}

// ── Toast notification helper ──────────────────────────────────────────────────────────────
let _toastTimeout = null;
function showToast(message, type = 'success') {
    const toast = document.getElementById('foyerToast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `foyer-toast foyer-toast--${type} show`;
    if (_toastTimeout) clearTimeout(_toastTimeout);
    _toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// Drag and drop variables
let draggedElement = null;
let draggedCategoryIndex = null;
let draggedItemIndex = null;
let placeholder = null;

// Section drag variables
let draggedSectionIndex = null;
let draggedSectionElement = null;
let sectionPlaceholder = null;

// Cache DOM elements for better performance
const elements = {
    grid: null,
    addModal: null,
    editModal: null,
    sectionModal: null,
    sectionForm: null,
    sectionNameInput: null,
    sectionIconInput: null,
    addSectionBtn: null,
    addSiteBtn: null
};

// Initialize cached elements
function initElements() {
    elements.grid = document.getElementById('shortcutsGrid');
    elements.addModal = document.getElementById('addSiteModal');
    elements.editModal = document.getElementById('editSiteModal');
    elements.sectionModal = document.getElementById('sectionModal');
    elements.sectionForm = document.getElementById('sectionForm');
    elements.sectionNameInput = document.getElementById('sectionName');
    elements.sectionIconInput = document.getElementById('sectionIcon');
    elements.addSectionBtn = document.getElementById('addSectionBtn');
    elements.addSiteBtn = document.getElementById('addSiteBtn');
}

// Render shortcuts grid with categories
function renderShortcuts() {
    const grid = elements.grid || document.getElementById('shortcutsGrid');

    // Clean up any existing dropdown menus from body
    document.querySelectorAll('.shortcut-menu-dropdown').forEach(dropdown => {
        dropdown.remove();
    });

    grid.innerHTML = '';

    categories.forEach((category, categoryIndex) => {
        // Create category section
        const categorySection = document.createElement('div');
        categorySection.className = 'category-section';
        categorySection.setAttribute('data-category-id', category.id);

        // Create category header (draggable for section reordering)
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.draggable = true;
        categoryHeader.setAttribute('data-section-index', categoryIndex);

        // Add drag handle icon
        const dragHandle = document.createElement('span');
        dragHandle.className = 'section-drag-handle';
        dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
        dragHandle.title = 'Drag to reorder section';

        const headerContent = document.createElement('div');
        headerContent.className = 'category-header-content';

        const categoryIcon = document.createElement('span');
        categoryIcon.className = 'category-icon';
        categoryIcon.textContent = (category.icon && category.icon.trim()) || '📁';

        const categoryTitle = document.createElement('h3');
        categoryTitle.className = 'category-title';
        const displayName = getCategoryDisplayName(category) || category.name || 'Untitled Section';
        categoryTitle.textContent = displayName;

        headerContent.appendChild(categoryIcon);
        headerContent.appendChild(categoryTitle);

        categoryHeader.appendChild(dragHandle);

        const countBadge = document.createElement('span');
        countBadge.className = 'category-count';
        countBadge.textContent = category.websites.length;

        const editSectionBtn = document.createElement('button');
        editSectionBtn.className = 'section-edit-btn';
        editSectionBtn.type = 'button';
        editSectionBtn.setAttribute('aria-label', `Edit ${displayName} section`);
        editSectionBtn.innerHTML = '<i class="fas fa-pen"></i>';
        editSectionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSectionModal('edit', categoryIndex);
        });

        categoryHeader.appendChild(headerContent);
        categoryHeader.appendChild(countBadge);
        categoryHeader.appendChild(editSectionBtn);

        // Add section drag event listeners
        categoryHeader.addEventListener('dragstart', handleSectionDragStart);
        categoryHeader.addEventListener('dragend', handleSectionDragEnd);

        // Create category grid (always visible)
        const categoryGrid = document.createElement('div');
        categoryGrid.className = 'category-grid';
        categoryGrid.setAttribute('data-category-index', categoryIndex);

        // Add grid-level drag-over handlers
        categoryGrid.addEventListener('dragenter', function (e) {
            if (e.target === this || this.contains(e.target)) {
                this.classList.add('drag-over');
            }
        });

        categoryGrid.addEventListener('dragleave', function (e) {
            if (e.target === this || !this.contains(e.relatedTarget)) {
                this.classList.remove('drag-over');
            }
        });

        categoryGrid.addEventListener('dragover', handleDragOver);

        categoryGrid.addEventListener('drop', function (e) {
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            e.preventDefault();

            this.classList.remove('drag-over');

            if (!draggedElement) return false;

            const dropCategoryIndex = parseInt(this.getAttribute('data-category-index'));
            const draggedSite = categories[draggedCategoryIndex].websites[draggedItemIndex];

            // Calculate drop position (end of category if dropping on empty space)
            let dropItemIndex = categories[dropCategoryIndex].websites.length;

            // If placeholder exists, use its position
            if (placeholder && placeholder.parentNode === this) {
                const itemsBefore = Array.from(this.children)
                    .slice(0, Array.from(this.children).indexOf(placeholder))
                    .filter(child =>
                        child.classList.contains('shortcut-item') &&
                        !child.classList.contains('add-site-btn') &&
                        !child.classList.contains('placeholder')
                    ).length;
                dropItemIndex = itemsBefore;
            }

            // Move the website
            categories[draggedCategoryIndex].websites.splice(draggedItemIndex, 1);

            // Adjust if moving within same category
            if (draggedCategoryIndex === dropCategoryIndex && draggedItemIndex < dropItemIndex) {
                dropItemIndex--;
            }

            categories[dropCategoryIndex].websites.splice(dropItemIndex, 0, draggedSite);

            saveCategories();

            // Update affected grids
            const affectedCategories = [draggedCategoryIndex];
            if (draggedCategoryIndex !== dropCategoryIndex) {
                affectedCategories.push(dropCategoryIndex);
            }

            affectedCategories.forEach(catIndex => updateCategoryGrid(catIndex));

            return false;
        });

        // Render all websites (no conditional rendering)
        category.websites.forEach((site, itemIndex) => {
            const shortcut = createShortcutElement(site, categoryIndex, itemIndex);
            categoryGrid.appendChild(shortcut);
        });

        categorySection.appendChild(categoryHeader);
        categorySection.appendChild(categoryGrid);
        grid.appendChild(categorySection);
    });

    // Add section drag-over and drop handlers to the grid container
    grid.addEventListener('dragover', handleSectionDragOver);
    grid.addEventListener('drop', handleSectionDrop);
}

// Helper: Update only specific category grid without full reload
function updateCategoryGrid(categoryIndex) {
    const category = categories[categoryIndex];
    const categoryGrid = document.querySelector(`.category-grid[data-category-index="${categoryIndex}"]`);

    if (!categoryGrid) return;

    // Remove placeholder if it belongs to this grid
    if (placeholder && placeholder.parentNode === categoryGrid) {
        placeholder.parentNode.removeChild(placeholder);
    }

    // Remove existing shortcuts (keep add button if it's the last grid)
    const existingShortcuts = Array.from(categoryGrid.children).filter(
        child => child.classList.contains('shortcut-item') && !child.classList.contains('add-site-btn')
    );
    existingShortcuts.forEach(item => item.remove());

    // Re-create shortcuts with fresh data
    category.websites.forEach((site, itemIndex) => {
        const shortcut = createShortcutElement(site, categoryIndex, itemIndex);
        categoryGrid.appendChild(shortcut);
    });

    // Update category count
    updateCategoryCount(categoryIndex);
}

// Helper: Create shortcut element
function createShortcutElement(site, categoryIndex, itemIndex) {
    const shortcut = document.createElement('div');
    shortcut.className = 'shortcut-item';
    shortcut.setAttribute('data-name', site.name);
    shortcut.setAttribute('data-category-index', categoryIndex);
    shortcut.setAttribute('data-item-index', itemIndex);
    shortcut.setAttribute('draggable', 'true');
    const column = itemIndex % 4;
    const row = Math.floor(itemIndex / 4);
    const delay = (categoryIndex * 0.2) + (row * 0.06) + (column * 0.02);
    shortcut.style.animationDelay = `${delay}s`;

    // Add drag event listeners
    shortcut.addEventListener('dragstart', handleDragStart);
    shortcut.addEventListener('dragover', handleDragOver);
    shortcut.addEventListener('drop', handleDrop);
    shortcut.addEventListener('dragend', handleDragEnd);
    shortcut.addEventListener('dragenter', handleDragEnter);
    shortcut.addEventListener('dragleave', handleDragLeave);

    const link = document.createElement('a');
    link.href = site.url;
    link.target = '_self';
    link.rel = 'noopener noreferrer';
    link.className = 'shortcut-link';
    link.setAttribute('aria-label', `Visit ${site.name}`);
    link.addEventListener('click', (e) => {
        if (shortcut.classList.contains('dragging')) {
            e.preventDefault();
        }
    });

    const icon = document.createElement('div');
    icon.className = 'shortcut-icon';

    const img = document.createElement('img');
    img.src = site.customIcon || getFaviconUrl(site.domain);
    img.alt = site.name;
    img.loading = 'lazy';
    img.draggable = false;

    img.onerror = function () {
        if (!this.dataset.attempted) {
            this.dataset.attempted = 'true';
            this.src = `https://www.google.com/s2/favicons?domain=${site.domain}&sz=64`;
        } else if (!this.dataset.attempted2) {
            this.dataset.attempted2 = 'true';
            this.src = `https://logo.clearbit.com/${site.domain}`;
        } else if (!this.dataset.attempted3) {
            this.dataset.attempted3 = 'true';
            this.src = `https://icons.duckduckgo.com/ip3/${site.domain}.ico`;
        } else if (!this.dataset.attempted4) {
            this.dataset.attempted4 = 'true';
            this.src = `https://api.faviconkit.com/${site.domain}/128`;
        } else if (!this.dataset.attempted5) {
            this.dataset.attempted5 = 'true';
            try {
                const urlObj = new URL(site.url);
                this.src = `${urlObj.origin}/favicon.ico`;
            } catch (e) {
                this.style.display = 'none';
                icon.innerHTML = `<span style="font-size: 24px; font-weight: 600; color: var(--text-color);">${site.name.charAt(0).toUpperCase()}</span>`;
            }
        } else {
            this.style.display = 'none';
            icon.innerHTML = `<span style="font-size: 24px; font-weight: 600; color: var(--text-color);">${site.name.charAt(0).toUpperCase()}</span>`;
        }
    };

    // Create ellipsis menu button and dropdown
    const menuBtn = document.createElement('button');
    menuBtn.className = 'shortcut-menu-btn';
    menuBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
    menuBtn.setAttribute('aria-label', `Options for ${site.name}`);
    menuBtn.setAttribute('title', 'Options');

    const menuDropdown = document.createElement('div');
    menuDropdown.className = 'shortcut-menu-dropdown';

    const editOption = document.createElement('button');
    editOption.className = 'menu-option edit-option';
    editOption.innerHTML = '<i class="fas fa-edit"></i><span>Edit</span>';
    editOption.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeAllMenus();
        showEditSiteModal(categoryIndex, itemIndex);
    });

    const deleteOption = document.createElement('button');
    deleteOption.className = 'menu-option delete-option';
    deleteOption.innerHTML = '<i class="fas fa-trash"></i><span>Delete</span>';
    deleteOption.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeAllMenus();
        deleteSite(categoryIndex, itemIndex);
    });

    menuDropdown.appendChild(editOption);
    menuDropdown.appendChild(deleteOption);

    menuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleShortcutMenu(shortcut, menuDropdown, menuBtn);
    });

    icon.appendChild(img);
    link.appendChild(icon);
    shortcut.appendChild(link);

    // Add permanent name label below icon
    const nameLabel = document.createElement('span');
    nameLabel.className = 'shortcut-name';
    nameLabel.textContent = site.name;
    nameLabel.title = site.name; // Full name on hover
    shortcut.appendChild(nameLabel);

    shortcut.appendChild(menuBtn);
    // Append dropdown to body for proper z-index stacking
    document.body.appendChild(menuDropdown);

    return shortcut;
}

// Helper: Update category count badge
function updateCategoryCount(categoryIndex) {
    const category = categories[categoryIndex];
    const categorySection = document.querySelector(`.category-section[data-category-id="${category.id}"]`);
    if (categorySection) {
        const countBadge = categorySection.querySelector('.category-count');
        if (countBadge) {
            countBadge.textContent = category.websites.length;
        }
    }
}

// Helper: Find element after which to insert (based on cursor position)
function getDragAfterElement(container, x, y) {
    const draggableElements = [...container.querySelectorAll('.shortcut-item:not(.dragging):not(.add-site-btn):not(.placeholder)')];

    // If grid is empty, return null to append at end
    if (draggableElements.length === 0) {
        return null;
    }

    let closestElement = null;
    let closestOffset = Number.POSITIVE_INFINITY;

    draggableElements.forEach(child => {
        const box = child.getBoundingClientRect();

        // Calculate center of the element
        const centerX = box.left + box.width / 2;
        const centerY = box.top + box.height / 2;

        // Calculate distance from cursor to center
        const offsetX = x - centerX;
        const offsetY = y - centerY;
        const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

        // If cursor is past this element (to the right or below), consider it
        const isPastElement = (y > box.top && (x > box.left + box.width || y > box.bottom));

        if (distance < closestOffset) {
            closestOffset = distance;
            closestElement = child;
        }
    });

    // If we found an element, check if cursor is after it
    if (closestElement) {
        const box = closestElement.getBoundingClientRect();
        const centerX = box.left + box.width / 2;
        const centerY = box.top + box.height / 2;

        // If cursor is to the right or below the center, insert after this element
        if (x > centerX || (y > centerY && x > box.left)) {
            // Return the next sibling or null to insert at end
            const nextElement = closestElement.nextElementSibling;
            return (nextElement && !nextElement.classList.contains('add-site-btn')) ? nextElement : null;
        }

        return closestElement;
    }

    return null;
}

// Drag and drop handlers
function handleDragStart(e) {
    // Prevent app dragging when section is being dragged
    if (draggedSectionIndex !== null) {
        e.preventDefault();
        return;
    }

    draggedElement = this;
    draggedCategoryIndex = parseInt(this.getAttribute('data-category-index'));
    draggedItemIndex = parseInt(this.getAttribute('data-item-index'));

    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);

    // Create placeholder
    placeholder = document.createElement('div');
    placeholder.className = 'shortcut-item placeholder';
    placeholder.style.width = this.offsetWidth + 'px';
    placeholder.style.height = this.offsetHeight + 'px';

    // Slight delay for drag effect
    setTimeout(() => {
        if (draggedElement) {
            draggedElement.style.opacity = '0.4';
        }
    }, 0);
}

function handleDragOver(e) {
    // Ignore if section is being dragged
    if (draggedSectionIndex !== null) return false;

    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    if (!draggedElement || !placeholder) return false;

    // Find the closest category-grid
    const target = e.target.closest('.category-grid');
    if (!target) return false;

    // Don't insert placeholder if hovering over the dragged element itself
    if (e.target === draggedElement || draggedElement.contains(e.target)) {
        return false;
    }

    // Calculate where to insert placeholder
    const afterElement = getDragAfterElement(target, e.clientX, e.clientY);

    // Remove placeholder from its current position if it exists
    if (placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
    }

    if (afterElement == null) {
        // Append at the end
        target.appendChild(placeholder);
    } else {
        // Insert before the afterElement
        target.insertBefore(placeholder, afterElement);
    }

    return false;
}

function handleDragEnter(e) {
    if (this !== draggedElement && !this.classList.contains('add-site-btn')) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    // Only remove if actually leaving, not moving to child
    if (!this.contains(e.relatedTarget)) {
        this.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (!draggedElement) return false;

    const targetGrid = e.target.closest('.category-grid');
    if (!targetGrid) return false;

    const dropCategoryIndex = parseInt(targetGrid.getAttribute('data-category-index'));

    // Calculate drop position based on placeholder location
    let dropItemIndex = 0;
    if (placeholder && placeholder.parentNode) {
        const allItems = Array.from(placeholder.parentNode.children).filter(
            child => child.classList.contains('shortcut-item') &&
                !child.classList.contains('add-site-btn') &&
                !child.classList.contains('placeholder')
        );
        const placeholderIndex = Array.from(placeholder.parentNode.children).indexOf(placeholder);
        const itemsBefore = Array.from(placeholder.parentNode.children)
            .slice(0, placeholderIndex)
            .filter(child =>
                child.classList.contains('shortcut-item') &&
                !child.classList.contains('add-site-btn') &&
                !child.classList.contains('placeholder')
            ).length;
        dropItemIndex = itemsBefore;
    }

    // Move the website in data
    const draggedSite = categories[draggedCategoryIndex].websites[draggedItemIndex];

    categories[draggedCategoryIndex].websites.splice(draggedItemIndex, 1);

    // Adjust dropItemIndex if moving within same category and moving down
    if (draggedCategoryIndex === dropCategoryIndex && draggedItemIndex < dropItemIndex) {
        dropItemIndex--;
    }

    categories[dropCategoryIndex].websites.splice(dropItemIndex, 0, draggedSite);

    saveCategories();

    // Only update affected grids (no full reload!)
    const affectedCategories = [draggedCategoryIndex];
    if (draggedCategoryIndex !== dropCategoryIndex) {
        affectedCategories.push(dropCategoryIndex);
    }

    affectedCategories.forEach(catIndex => updateCategoryGrid(catIndex));

    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    this.style.opacity = '';

    // Remove all drag-over classes
    document.querySelectorAll('.shortcut-item, .category-grid').forEach(item => {
        item.classList.remove('drag-over');
    });

    // Remove placeholder
    if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
    }

    draggedElement = null;
    draggedCategoryIndex = null;
    draggedItemIndex = null;
    placeholder = null;
}

// ========================================
// SECTION DRAG AND DROP HANDLERS
// ========================================

function handleSectionDragStart(e) {
    // Prevent app dragging when dragging section
    if (draggedElement) return;

    const header = this;
    const section = header.parentElement;

    draggedSectionElement = section;
    draggedSectionIndex = parseInt(header.getAttribute('data-section-index'));

    console.log('Starting drag of section:', draggedSectionIndex);

    header.style.opacity = '0.4';
    section.classList.add('dragging-section');

    // Create section placeholder
    sectionPlaceholder = document.createElement('div');
    sectionPlaceholder.className = 'section-placeholder';
    sectionPlaceholder.style.height = section.offsetHeight + 'px';

    // Set drag image
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', header.innerHTML);
}

function handleSectionDragOver(e) {
    if (draggedSectionIndex === null) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const grid = e.currentTarget;
    const afterElement = getSectionAfterElement(grid, e.clientY);

    if (afterElement == null) {
        grid.appendChild(sectionPlaceholder);
    } else {
        grid.insertBefore(sectionPlaceholder, afterElement);
    }
}

function getSectionAfterElement(gridContainer, y) {
    const draggableElements = [...gridContainer.querySelectorAll('.category-section:not(.dragging-section)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function handleSectionDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    if (draggedSectionIndex === null) {
        console.log('No section being dragged');
        return;
    }

    if (!sectionPlaceholder || !sectionPlaceholder.parentNode) {
        console.log('No placeholder found');
        return;
    }

    // Get all sections excluding the placeholder and dragged section
    const grid = document.getElementById('shortcutsGrid');
    const allChildren = [...grid.children];

    // Find placeholder position among all children
    const placeholderIndex = allChildren.indexOf(sectionPlaceholder);

    if (placeholderIndex === -1) {
        console.log('Placeholder not in DOM');
        return;
    }

    // Count only category-section elements before placeholder
    let newIndex = 0;
    for (let i = 0; i < placeholderIndex; i++) {
        if (allChildren[i].classList.contains('category-section') &&
            !allChildren[i].classList.contains('dragging-section')) {
            newIndex++;
        }
    }

    console.log(`Moving section from ${draggedSectionIndex} to ${newIndex}`);

    // Only move if position changed
    if (draggedSectionIndex !== newIndex) {
        // Move category in array
        const movedCategory = categories.splice(draggedSectionIndex, 1)[0];
        categories.splice(newIndex, 0, movedCategory);

        console.log('Categories reordered:', categories.map(c => getCategoryDisplayName(c)));

        // Save and re-render
        saveCategories();
        renderShortcuts();

        // Show notification
        showNotification(`Section "${getCategoryDisplayName(movedCategory)}" moved`, 'success');
    }
}

function handleSectionDragEnd(e) {
    const header = this;
    const section = header.parentElement;

    header.style.opacity = '';
    section.classList.remove('dragging-section');

    console.log('Drag ended');

    // Remove placeholder
    if (sectionPlaceholder && sectionPlaceholder.parentNode) {
        sectionPlaceholder.parentNode.removeChild(sectionPlaceholder);
    }

    // Remove drag-over class from all sections
    document.querySelectorAll('.category-section').forEach(section => {
        section.classList.remove('drag-over');
    });

    draggedSectionElement = null;
    draggedSectionIndex = null;
    sectionPlaceholder = null;
}

// Delete site
function deleteSite(categoryIndex, itemIndex) {
    const site = categories[categoryIndex].websites[itemIndex];
    if (confirm(`Remove "${site.name}" from shortcuts?`)) {
        categories[categoryIndex].websites.splice(itemIndex, 1);
        saveCategories();
        updateCategoryGrid(categoryIndex);
    }
}

// Edit site modal
let editingCategoryIndex = null;
let editingItemIndex = null;
let sectionModalMode = 'add';
let editingSectionIndex = null;

function showEditSiteModal(categoryIndex, itemIndex) {
    editingCategoryIndex = categoryIndex;
    editingItemIndex = itemIndex;
    const site = categories[categoryIndex].websites[itemIndex];
    const modal = document.getElementById('editSiteModal');
    document.getElementById('editSiteName').value = site.name;
    document.getElementById('editSiteUrl').value = site.url;

    // Set category dropdown
    const categorySelect = document.getElementById('editSiteCategory');
    if (categorySelect) {
        categorySelect.value = categories[categoryIndex].id;
    }

    modal.style.display = 'flex';
    document.getElementById('editSiteName').focus();
}

function closeEditSiteModal() {
    const modal = document.getElementById('editSiteModal');
    modal.style.display = 'none';
    document.getElementById('editSiteName').value = '';
    document.getElementById('editSiteUrl').value = '';
    editingCategoryIndex = null;
    editingItemIndex = null;
}

async function updateSite() {
    if (editingCategoryIndex === null || editingItemIndex === null) return;

    const nameInput = document.getElementById('editSiteName');
    const urlInput = document.getElementById('editSiteUrl');
    const categorySelect = document.getElementById('editSiteCategory');

    if (!nameInput || !urlInput) return;

    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    const newCategoryId = categorySelect ? categorySelect.value : categories[editingCategoryIndex].id;

    // Validate input length
    if (!name || name.length > 50) {
        alert('Please enter a valid site name (1-50 characters)');
        return;
    }

    if (!url || url.length > 500) {
        alert('Please enter a valid URL (max 500 characters)');
        return;
    }

    // Add https:// if not present
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        fullUrl = 'https://' + url;
    }

    // Validate URL
    try {
        new URL(fullUrl);
    } catch (e) {
        alert('Please enter a valid URL');
        return;
    }

    // Extract clean root domain (abc.com only)
    const domain = getRootDomain(fullUrl);

    // Show loading state
    const submitBtn = document.querySelector('#editSiteModal .btn-primary');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Updating...';
    submitBtn.disabled = true;

    // Always fetch fresh favicon to ensure icon matches the domain
    const faviconUrl = await fetchActualFavicon(fullUrl, domain);

    const updatedSite = {
        name: name,
        url: fullUrl,
        domain: domain,
        customIcon: faviconUrl
    };

    // Check if category changed
    const oldCategoryId = categories[editingCategoryIndex].id;
    const affectedCategories = [editingCategoryIndex];

    if (newCategoryId !== oldCategoryId) {
        // Move to different category
        categories[editingCategoryIndex].websites.splice(editingItemIndex, 1);
        const newCategory = categories.find(cat => cat.id === newCategoryId);
        if (newCategory) {
            newCategory.websites.push(updatedSite);
            const newCategoryIndex = categories.indexOf(newCategory);
            affectedCategories.push(newCategoryIndex);
        }
    } else {
        // Update in same category
        categories[editingCategoryIndex].websites[editingItemIndex] = updatedSite;
    }

    saveCategories();

    // Only update affected grids
    affectedCategories.forEach(catIndex => updateCategoryGrid(catIndex));

    // Reset button state
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;

    closeEditSiteModal();
}

// Add site modal
function showAddSiteModal() {
    const modal = document.getElementById('addSiteModal');
    modal.style.display = 'flex';
    document.getElementById('siteName').focus();
}

function closeAddSiteModal() {
    const modal = document.getElementById('addSiteModal');
    modal.style.display = 'none';
    document.getElementById('siteName').value = '';
    document.getElementById('siteUrl').value = '';
}

async function addNewSite() {
    const nameInput = document.getElementById('siteName');
    const urlInput = document.getElementById('siteUrl');
    const categorySelect = document.getElementById('siteCategory');

    if (!nameInput || !urlInput) return;

    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    const categoryId = categorySelect ? categorySelect.value : categories[0].id; // Default to first category

    // Validate input length
    if (!name || name.length > 50) {
        alert('Please enter a valid site name (1-50 characters)');
        return;
    }

    if (!url || url.length > 500) {
        alert('Please enter a valid URL (max 500 characters)');
        return;
    }

    // Add https:// if not present
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        fullUrl = 'https://' + url;
    }

    // Validate URL
    try {
        new URL(fullUrl);
    } catch (e) {
        alert('Please enter a valid URL');
        return;
    }

    // Extract clean root domain (abc.com only)
    const domain = getRootDomain(fullUrl);

    // Show loading state
    const submitBtn = document.querySelector('#addSiteModal .btn-primary');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Adding...';
    submitBtn.disabled = true;

    // Try to fetch the actual favicon
    const faviconUrl = await fetchActualFavicon(fullUrl, domain);

    // Find target category and add site
    const category = categories.find(cat => cat.id === categoryId);
    if (category) {
        category.websites.push({
            id: generateSiteId(),
            name: name,
            url: fullUrl,
            domain: domain,
            customIcon: faviconUrl
        });

        saveCategories();

        // Only update the affected category grid
        const categoryIndex = categories.indexOf(category);
        updateCategoryGrid(categoryIndex);
    }

    // Reset button state
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;

    closeAddSiteModal();
}

// Fetch actual favicon from website

// Fetch actual favicon from website
async function fetchActualFavicon(url, domain) {
    try {
        const origin = new URL(url).origin;
        // Domain is already cleaned by getRootDomain (e.g., abc.com)

        // Try multiple high-quality favicon sources in order of preference
        const faviconSources = [
            // Google's favicon service - most reliable and works for almost all sites
            `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
            `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
            // Clearbit Logo API - high quality logos for popular sites
            `https://logo.clearbit.com/${domain}`,
            // Direct site favicons - highest quality when available
            `${origin}/favicon.ico`,
            `${origin}/favicon.png`,
            `${origin}/apple-touch-icon.png`,
            `${origin}/apple-touch-icon-precomposed.png`,
            // DuckDuckGo's favicon service
            `https://icons.duckduckgo.com/ip3/${domain}.ico`,
            // Favicon Kit API
            `https://api.faviconkit.com/${domain}/128`
        ];

        // Try to load each source with a simple image test
        for (const source of faviconSources) {
            try {
                // Create a test image to check if the favicon loads
                const testLoad = await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(true);
                    img.onerror = () => reject(false);
                    img.src = source;
                    // Timeout after 3 seconds
                    setTimeout(() => reject(false), 3000);
                });

                if (testLoad) {
                    return source;
                }
            } catch (e) {
                continue;
            }
        }

        // Ultimate fallback to Google's favicon service
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch (e) {
        // Ultimate fallback
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    }
}

// Section management modal
function openSectionModal(mode = 'add', categoryIndex = null) {
    sectionModalMode = mode;
    editingSectionIndex = categoryIndex;
    const modal = elements.sectionModal || document.getElementById('sectionModal');
    const title = document.getElementById('sectionModalTitle');
    const submitBtn = modal.querySelector('.btn-primary');
    const nameInput = elements.sectionNameInput || document.getElementById('sectionName');
    const iconInput = elements.sectionIconInput || document.getElementById('sectionIcon');

    if (mode === 'edit' && categoryIndex !== null && categories[categoryIndex]) {
        const category = categories[categoryIndex];
        nameInput.value = getCategoryDisplayName(category) || category.name || '';
        iconInput.value = (category.icon || '').trim();
        title.textContent = 'Edit Section';
        submitBtn.textContent = 'Save Changes';
    } else {
        nameInput.value = '';
        iconInput.value = '';
        title.textContent = 'Add Section';
        submitBtn.textContent = 'Add Section';
        editingSectionIndex = null;
    }

    modal.style.display = 'flex';
    nameInput.focus();
}

function closeSectionModal() {
    const modal = elements.sectionModal || document.getElementById('sectionModal');
    if (!modal) return;
    modal.style.display = 'none';
    const nameInput = elements.sectionNameInput || document.getElementById('sectionName');
    const iconInput = elements.sectionIconInput || document.getElementById('sectionIcon');
    if (nameInput) nameInput.value = '';
    if (iconInput) iconInput.value = '';
    sectionModalMode = 'add';
    editingSectionIndex = null;
}

function handleSectionSubmit(e) {
    e.preventDefault();
    const nameInput = elements.sectionNameInput || document.getElementById('sectionName');
    const iconInput = elements.sectionIconInput || document.getElementById('sectionIcon');
    if (!nameInput) return;
    const rawName = nameInput.value.trim();
    const rawIcon = iconInput ? iconInput.value.trim() : '';
    if (!rawName) {
        alert('Please enter a section name');
        return;
    }
    let iconValue = rawIcon || rawName.charAt(0).toUpperCase() || '📁';
    iconValue = iconValue.substring(0, 2); // prevent long strings

    if (sectionModalMode === 'edit' && editingSectionIndex !== null && categories[editingSectionIndex]) {
        categories[editingSectionIndex].name = rawName;
        categories[editingSectionIndex].icon = iconValue;
    } else {
        const newCategory = {
            id: generateCategoryId(rawName),
            name: rawName,
            icon: iconValue,
            websites: []
        };
        categories.push(newCategory);
    }

    saveCategories();
    populateCategoryDropdowns();
    renderShortcuts();
    closeSectionModal();
}

// ========================================
// UNIFIED SEARCH WIDGET
// ========================================

// Search engine configurations
const searchEngines = {
    google: {
        name: 'Google',
        icon: 'fab fa-google',
        color: '#4285F4',
        placeholder: 'Search Google...',
        url: 'https://www.google.com/search?q='
    },
    youtube: {
        name: 'YouTube',
        icon: 'fab fa-youtube',
        color: '#FF0000',
        placeholder: 'Search YouTube...',
        url: 'https://www.youtube.com/results?search_query='
    },
    perplexity: {
        name: 'Perplexity',
        icon: 'fas fa-brain',
        color: '#20808D',
        placeholder: 'Search Perplexity...',
        url: 'https://www.perplexity.ai/search?q='
    },
    x: {
        name: 'X',
        icon: 'fab fa-x-twitter',
        color: '#000000',
        placeholder: 'Search X...',
        url: 'https://twitter.com/search?q='
    },
    reddit: {
        name: 'Reddit',
        icon: 'fab fa-reddit-alien',
        color: '#FF4500',
        placeholder: 'Search Reddit...',
        url: 'https://www.reddit.com/search/?q='
    },
    wikipedia: {
        name: 'Wikipedia',
        icon: 'fab fa-wikipedia-w',
        color: '#000000',
        placeholder: 'Search Wikipedia...',
        url: 'https://en.wikipedia.org/wiki/Special:Search?search='
    }
};

// Current search engine state
let currentEngine = localStorage.getItem('selectedSearchEngine') || 'google';
const MAX_HISTORY_ITEMS = 8;

// Initialize unified search widget
function initUnifiedSearch() {
    const savedEngine = localStorage.getItem('selectedSearchEngine') || 'google';
    selectSearchEngine(savedEngine, false);

    setupEngineDropdown();
    setupSearchHistory();
}

// Setup engine dropdown toggle
function setupEngineDropdown() {
    const selector = document.getElementById('engineSelector');
    const dropdown = document.getElementById('engineDropdown');

    if (!selector || !dropdown) return;

    // Toggle dropdown on click
    selector.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('show');
        dropdown.classList.toggle('show');
        selector.setAttribute('aria-expanded', !isOpen);
    });

    // Engine option clicks
    dropdown.querySelectorAll('.engine-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const engine = option.dataset.engine;
            selectSearchEngine(engine);
            dropdown.classList.remove('show');
            selector.setAttribute('aria-expanded', 'false');
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!selector.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
            selector.setAttribute('aria-expanded', 'false');
        }
    });

    // Close dropdown on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dropdown.classList.remove('show');
            selector.setAttribute('aria-expanded', 'false');
        }
    });
}

// Select a search engine
function selectSearchEngine(engineKey, save = true) {
    const engine = searchEngines[engineKey];
    if (!engine) return;

    currentEngine = engineKey;

    // Update widget styling
    const widget = document.getElementById('unifiedSearchWidget');
    const iconElement = document.getElementById('currentEngineIcon');
    const input = document.getElementById('unifiedSearchInput');
    const submitBtn = document.getElementById('searchSubmitBtn');

    if (widget) {
        widget.style.setProperty('--engine-color', engine.color);
    }

    if (iconElement) {
        iconElement.className = engine.icon;
    }

    if (input) {
        input.placeholder = engine.placeholder;
    }

    // Update active state in dropdown
    document.querySelectorAll('.engine-option').forEach(option => {
        option.classList.toggle('active', option.dataset.engine === engineKey);
    });

    // Save preference
    if (save) {
        localStorage.setItem('selectedSearchEngine', engineKey);
        scheduleFirestoreSync(); // Sync engine preference to Firestore
    }

    // Hide history dropdown when switching engines
    hideSearchHistory();
}

// Perform search with current engine
function performUnifiedSearch(event) {
    event.preventDefault();

    const input = document.getElementById('unifiedSearchInput');
    const query = input.value.trim();

    if (!query) return false;

    const engine = searchEngines[currentEngine];
    if (!engine) return false;

    // Save to search history (per engine)
    saveToSearchHistory(currentEngine, query);

    // Open search in same tab
    window.location.href = `${engine.url}${encodeURIComponent(query)}`;

    // Clear input
    input.value = '';
    hideSearchHistory();

    return false;
}

// ========================================
// SEARCH HISTORY SYSTEM
// ========================================

function setupSearchHistory() {
    const input = document.getElementById('unifiedSearchInput');
    const historyDropdown = document.getElementById('searchHistoryDropdown');

    if (!input || !historyDropdown) return;

    // Show history on focus (for all engines now)
    input.addEventListener('focus', () => {
        showSearchHistory();
    });

    // Filter history as user types
    input.addEventListener('input', () => {
        showSearchHistory(input.value);
    });

    // Hide history when clicking outside
    document.addEventListener('click', (e) => {
        const inputWrapper = input.closest('.search-input-wrapper');
        if (!inputWrapper.contains(e.target)) {
            hideSearchHistory();
        }
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        handleHistoryNavigation(e);
    });
}

function getSearchHistory(engine) {
    const historyKey = `searchHistory_${engine}`;
    const history = localStorage.getItem(historyKey);
    return history ? JSON.parse(history) : [];
}

function saveToSearchHistory(engine, query) {
    const historyKey = `searchHistory_${engine}`;
    let history = getSearchHistory(engine);

    // Remove duplicate if exists
    history = history.filter(item => item.toLowerCase() !== query.toLowerCase());

    // Add to beginning
    history.unshift(query);

    // Limit to max items
    history = history.slice(0, MAX_HISTORY_ITEMS);

    localStorage.setItem(historyKey, JSON.stringify(history));
}

function removeFromSearchHistory(engine, query) {
    const historyKey = `searchHistory_${engine}`;
    let history = getSearchHistory(engine);
    history = history.filter(item => item !== query);
    localStorage.setItem(historyKey, JSON.stringify(history));
}

function showSearchHistory(filterText = '') {
    const historyDropdown = document.getElementById('searchHistoryDropdown');
    const input = document.getElementById('unifiedSearchInput');

    if (!historyDropdown) return;

    let history = getSearchHistory(currentEngine);

    // Filter by input text
    if (filterText) {
        history = history.filter(item =>
            item.toLowerCase().includes(filterText.toLowerCase())
        );
    }

    if (history.length === 0) {
        historyDropdown.classList.remove('show');
        return;
    }

    const engineConfig = searchEngines[currentEngine];

    historyDropdown.innerHTML = history.map((item, index) => `
        <div class="history-item" data-index="${index}" data-query="${escapeHtml(item)}">
            <i class="fas fa-history"></i>
            <span class="history-text">${escapeHtml(item)}</span>
            <button type="button" class="history-remove" data-query="${escapeHtml(item)}" title="Remove">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    // Add click handlers
    historyDropdown.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.history-remove')) {
                input.value = item.dataset.query;
                hideSearchHistory();
                input.focus();
            }
        });
    });

    // Add remove handlers
    historyDropdown.querySelectorAll('.history-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromSearchHistory(currentEngine, btn.dataset.query);
            showSearchHistory(input.value);
        });
    });

    historyDropdown.classList.add('show');
}

function hideSearchHistory() {
    const historyDropdown = document.getElementById('searchHistoryDropdown');
    if (historyDropdown) {
        historyDropdown.classList.remove('show');
    }
}

function handleHistoryNavigation(e) {
    const historyDropdown = document.getElementById('searchHistoryDropdown');
    const input = document.getElementById('unifiedSearchInput');

    if (!historyDropdown.classList.contains('show')) return;

    const items = historyDropdown.querySelectorAll('.history-item');
    const activeItem = historyDropdown.querySelector('.history-item.active');
    let activeIndex = -1;

    if (activeItem) {
        activeIndex = parseInt(activeItem.dataset.index);
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
        updateActiveHistoryItem(items, nextIndex);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
        updateActiveHistoryItem(items, prevIndex);
    } else if (e.key === 'Enter' && activeItem) {
        e.preventDefault();
        input.value = activeItem.dataset.query;
        hideSearchHistory();
    } else if (e.key === 'Escape') {
        hideSearchHistory();
    }
}

function updateActiveHistoryItem(items, activeIndex) {
    items.forEach((item, index) => {
        item.classList.toggle('active', index === activeIndex);
    });

    // Update input value to match highlighted item
    const input = document.getElementById('unifiedSearchInput');
    if (items[activeIndex]) {
        input.value = items[activeIndex].dataset.query;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Legacy search functions (kept for backwards compatibility)
function searchGoogle(event) {
    event.preventDefault();
    const query = document.getElementById('googleSearch')?.value.trim() ||
        document.getElementById('unifiedSearchInput')?.value.trim();
    if (query) {
        saveToSearchHistory('google', query);
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }
    return false;
}

function searchYouTube(event) {
    event.preventDefault();
    const query = document.getElementById('youtubeSearch')?.value.trim() ||
        document.getElementById('unifiedSearchInput')?.value.trim();
    if (query) {
        saveToSearchHistory('youtube', query);
        window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    }
    return false;
}

function searchPerplexity(event) {
    event.preventDefault();
    const query = document.getElementById('perplexitySearch')?.value.trim() ||
        document.getElementById('unifiedSearchInput')?.value.trim();
    if (query) {
        saveToSearchHistory('perplexity', query);
        window.location.href = `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`;
    }
    return false;
}

function searchX(event) {
    event.preventDefault();
    const query = document.getElementById('xSearch')?.value.trim() ||
        document.getElementById('unifiedSearchInput')?.value.trim();
    if (query) {
        saveToSearchHistory('x', query);
        window.location.href = `https://twitter.com/search?q=${encodeURIComponent(query)}`;
    }
    return false;
}

function searchReddit(event) {
    event.preventDefault();
    const query = document.getElementById('redditSearch')?.value.trim() ||
        document.getElementById('unifiedSearchInput')?.value.trim();
    if (query) {
        saveToSearchHistory('reddit', query);
        window.location.href = `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`;
    }
    return false;
}

// Debounced input handler (for performance optimization)
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add debounced input handlers if needed for autocomplete in future
const inputs = document.querySelectorAll('.widget-input');
inputs.forEach(input => {
    input.addEventListener('input', debounce((e) => {
        // Future: Add autocomplete or suggestions here
    }, 300));
});

// Populate category dropdowns in modals
function populateCategoryDropdowns() {
    const addCategorySelect = document.getElementById('siteCategory');
    const editCategorySelect = document.getElementById('editSiteCategory');

    if (addCategorySelect) {
        addCategorySelect.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = formatCategoryLabel(cat);
            addCategorySelect.appendChild(option);
        });
    }

    if (editCategorySelect) {
        editCategorySelect.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = formatCategoryLabel(cat);
            editCategorySelect.appendChild(option);
        });
    }
}

// ========================================
// EXPORT/IMPORT FUNCTIONALITY
// ========================================

function exportData() {
    const data = {
        categories: categories,
        categoryStates: JSON.parse(localStorage.getItem('categoryStates') || '{}'),
        websites: JSON.parse(localStorage.getItem('websites') || '[]'),
        exportedAt: new Date().toISOString(),
        version: '1.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `homepage-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show success message
    showNotification('Data exported successfully! Check your Downloads folder.', 'success');
}

function importData() {
    const fileInput = document.getElementById('importFileInput');
    fileInput.click();
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    // Make the onload callback async so we can await the database write
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);

            // Validate data structure
            if (!data.categories || !Array.isArray(data.categories)) {
                throw new Error('Invalid data format: missing categories array');
            }

            // Confirm before overwriting
            if (!confirm('This will replace all your current data. Continue?')) {
                return;
            }

            // 1. Update the local variable
            categories = data.categories;

            // 2. Update localStorage immediately for offline fallback
            localStorage.setItem('categories', JSON.stringify(categories));

            // 3. Force an IMMEDIATE sync to Firestore (bypassing the 2-second delay)
            if (window.fs && window.currentUser) {
                await forceSyncToFirestore();
            }

            // Restore other settings
            if (data.categoryStates) {
                localStorage.setItem('categoryStates', JSON.stringify(data.categoryStates));
            }
            if (data.websites) {
                localStorage.setItem('websites', JSON.stringify(data.websites));
            }

            // Refresh the page to show imported data safely
            showNotification('Data imported successfully! Refreshing...', 'success');
            setTimeout(() => {
                location.reload();
            }, 1000); // Shortened the reload time since the DB write is already confirmed

        } catch (error) {
            console.error('Import error:', error);
            showNotification('Error importing data: ' + error.message, 'error');
        }
    };

    reader.onerror = () => {
        showNotification('Error reading file', 'error');
    };

    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
}

function showNotification(message, type = 'info') {
    // Remove existing notification if any
    const existing = document.getElementById('notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    `;

    if (type === 'success') {
        notification.style.background = 'rgba(52, 211, 153, 0.9)';
        notification.style.color = 'white';
    } else if (type === 'error') {
        notification.style.background = 'rgba(248, 113, 113, 0.9)';
        notification.style.color = 'white';
    } else {
        notification.style.background = 'rgba(102, 126, 234, 0.9)';
        notification.style.color = 'white';
    }

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Setup modal event handlers
// Setup modal event handlers
function setupModalHandlers() {
    // Populate category dropdowns
    populateCategoryDropdowns();

    if (elements.addSectionBtn) {
        elements.addSectionBtn.addEventListener('click', () => openSectionModal('add'));
    }
    if (elements.addSiteBtn) {
        elements.addSiteBtn.addEventListener('click', showAddSiteModal);
    }
    const sectionForm = elements.sectionForm || document.getElementById('sectionForm');
    if (sectionForm) {
        sectionForm.addEventListener('submit', handleSectionSubmit);
    }
    const closeSectionBtn = document.getElementById('closeSectionModal');
    if (closeSectionBtn) {
        closeSectionBtn.addEventListener('click', closeSectionModal);
    }
    const cancelSectionBtn = document.getElementById('cancelSectionBtn');
    if (cancelSectionBtn) {
        cancelSectionBtn.addEventListener('click', closeSectionModal);
    }

    // Setup add modal handlers
    document.getElementById('closeModal').addEventListener('click', closeAddSiteModal);
    document.getElementById('cancelBtn').addEventListener('click', closeAddSiteModal);
    document.getElementById('addSiteForm').addEventListener('submit', (e) => {
        e.preventDefault();
        addNewSite();
    });

    // Setup edit modal handlers
    document.getElementById('closeEditModal').addEventListener('click', closeEditSiteModal);
    document.getElementById('cancelEditBtn').addEventListener('click', closeEditSiteModal);
    document.getElementById('editSiteForm').addEventListener('submit', (e) => {
        e.preventDefault();
        updateSite();
    });

    // --- Settings Modal Handlers ---
    const settingsModal = document.getElementById('settingsModal');
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const closeSettingsModalBtn = document.getElementById('closeSettingsModal');
    const cancelSettingsBtnModal = document.getElementById('cancelSettingsBtn');
    const settingsForm = document.getElementById('settingsForm');

    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
            // Close the user menu dropdown first
            document.getElementById('userMenu').classList.remove('show');
            // Populate the textarea with current keywords
            document.getElementById('wallpaperKeywords').value = customWallpaperKeywords;
            // Show the modal
            settingsModal.style.display = 'flex';
        });
    }

    const closeSettings = () => { 
        if (settingsModal) settingsModal.style.display = 'none'; 
    };
    
    if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener('click', closeSettings);
    if (cancelSettingsBtnModal) cancelSettingsBtnModal.addEventListener('click', closeSettings);

    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newKeywords = document.getElementById('wallpaperKeywords').value.trim();
            
            // Update the variable
            customWallpaperKeywords = newKeywords || UNSPLASH_CONFIG.query; // Fallback to default if empty
            
            // Save to Firestore
            scheduleFirestoreSync();
            
            // Show success and fetch a new wallpaper immediately with the new keywords
            showToast('Settings saved successfully!');
            fetchUnsplashWallpaper();
            closeSettings();
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const addModal = elements.addModal || document.getElementById('addSiteModal');
        const editModal = elements.editModal || document.getElementById('editSiteModal');
        const sectionModal = elements.sectionModal || document.getElementById('sectionModal');
        
        if (e.target === addModal) {
            closeAddSiteModal();
        }
        if (e.target === editModal) {
            closeEditSiteModal();
        }
        if (e.target === sectionModal) {
            closeSectionModal();
        }
        if (e.target === settingsModal) {
            closeSettings();
        }
    });
}

// Initialize app only after Firebase auth confirms the user is signed in
// (Event fired by firebase-auth-guard.js)
document.addEventListener('foyer-auth-ready', async () => {
    // Initialize cached element refs
    initElements();

    // 1. INSTANT UI: Draw apps from local storage immediately so there is no waiting
    loadCategoriesFromLocalStorage();
    renderShortcuts();
    initUnifiedSearch();

    // 2. BACKGROUND SYNC: Fetch cloud settings quietly
    await loadUserSettingsFromFirestore();
    await loadUnsplashState();

    // 3. CLOUD SYNC: Fetch fresh layout from Firestore and re-render ONLY if data changed
    if (window.fs && window.currentUser) {
        // Take a snapshot of the local data we just rendered
        const localDataSnapshot = JSON.stringify(categories);

        await loadCategoriesFromFirestore();

        // Only redraw the DOM if the cloud data is actually different!
        if (JSON.stringify(categories) !== localDataSnapshot) {
            renderShortcuts();
        }
    }

    setupModalHandlers();

    // Wire up the ♥ button with Unsplash-aware behavior
    setupHeartButton();

    // 4. WALLPAPER LAST: Start image fetch only after apps are completely painted
    initWallpaper();

    // Export/Import (kept as safety fallback)
    const exportBtn = document.getElementById('exportDataBtn');
    const importBtn = document.getElementById('importDataBtn');
    const importFileInput = document.getElementById('importFileInput');
    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (importBtn) importBtn.addEventListener('click', importData);
    if (importFileInput) importFileInput.addEventListener('change', handleImportFile);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Focus first search input on '/' key
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        const googleSearch = document.getElementById('googleSearch');
        if (googleSearch) googleSearch.focus();
    }

    // ESC to close modal
    if (e.key === 'Escape') {
        const addModal = elements.addModal || document.getElementById('addSiteModal');
        const editModal = elements.editModal || document.getElementById('editSiteModal');
        const sectionModal = elements.sectionModal || document.getElementById('sectionModal');
        if (addModal && addModal.style.display === 'flex') {
            closeAddSiteModal();
        }
        if (editModal && editModal.style.display === 'flex') {
            closeEditSiteModal();
        }
        if (sectionModal && sectionModal.style.display === 'flex') {
            closeSectionModal();
        }
    }
});
