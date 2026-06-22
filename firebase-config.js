// ============================================
// FIREBASE CONFIGURATION — Foyer
// ============================================
// Shared module: imported by firebase-auth-guard.js and login.html
// Uses Firebase JS SDK v10 via Google's CDN (no bundler required)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    updateProfile,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    getDocs,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Read from window.FOYER_CONFIG set by config.js (loaded before this module).
// If config.js is missing, all values will be empty strings and Firebase will fail to init.
if (!window.FOYER_CONFIG) {
    console.error('[Foyer] config.js is not loaded. Copy config.example.js → config.js and fill in your API keys.');
}
const _fc = window.FOYER_CONFIG?.firebase || {};

const firebaseConfig = {
    apiKey:            _fc.apiKey            || '',
    authDomain:        _fc.authDomain        || '',
    projectId:         _fc.projectId         || '',
    storageBucket:     _fc.storageBucket     || '',
    messagingSenderId: _fc.messagingSenderId || '',
    appId:             _fc.appId             || '',
    measurementId:     _fc.measurementId     || ''
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
    auth, db, app,
    GoogleAuthProvider, signInWithPopup,
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail,
    doc, getDoc, setDoc, deleteDoc,
    collection, getDocs, writeBatch
};
