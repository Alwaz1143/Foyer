import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBnouZo_2s_G9dgno7s1zdT39ome6DDQGQ",
  authDomain: "foyer-f0e5b.firebaseapp.com",
  projectId: "foyer-f0e5b",
  storageBucket: "foyer-f0e5b.firebasestorage.app",
  messagingSenderId: "870411037459",
  appId: "1:870411037459:web:c7d4c4fad0fb1cd86a08e6",
  measurementId: "G-20H7JQH0PP",
};

const apps = getApps();
const app = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0]!;
export const auth = getAuth(app);
export const db = getFirestore(app);
