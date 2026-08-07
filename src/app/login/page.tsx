"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import "@/styles/css/auth.css";

const ERROR_MAP: Record<string, string> = {
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password. Try again.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Try again later.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/network-request-failed": "Network error. Check your connection.",
  "auth/invalid-credential": "Invalid email or password.",
};

function friendlyError(code: string) {
  return ERROR_MAP[code] || "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const [signUp, setSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.replace("/");
    });
    return () => unsub();
  }, [router]);

  const showError = (msg: string) => { setError(msg); setSuccess(""); };
  const showSuccess = (msg: string) => { setSuccess(msg); setError(""); };

  const doSignIn = async (): Promise<boolean> => {
    if (!email || !password) {
      showError("Please fill in all fields.");
      return false;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (err: any) {
      showError(friendlyError(err.code));
      return false;
    }
  };

  const doSignUp = async (): Promise<boolean> => {
    if (!email || !password) {
      showError("Please fill in all fields.");
      return false;
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(result.user, { displayName: name });
      await ensureUserDoc(result.user, name);
      return true;
    } catch (err: any) {
      showError(friendlyError(err.code));
      return false;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    const ok = signUp ? await doSignUp() : await doSignIn();
    setLoading(false);
    if (ok) router.replace("/");
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await ensureUserDoc(result.user);
      router.replace("/");
    } catch (err: any) {
      setLoading(false);
      showError(friendlyError(err.code));
    }
  };

  const handleForgot = async () => {
    if (!email) { showError("Enter your email address above first."); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      showSuccess("Password reset email sent — check your inbox.");
    } catch (err: any) {
      showError(friendlyError(err.code));
    }
  };

  return (
    <>
      <div className="auth-bg">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
      </div>

      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="logo-icon-wrap">🚪</div>
            <h1 className="logo-name">Foyer</h1>
          </div>
          <p className="auth-tagline">Your personal browser homepage</p>

          <div className="auth-tabs">
            <button className={signUp ? "auth-tab" : "auth-tab active"} onClick={() => { setSignUp(false); setError(""); setSuccess(""); }}>Sign In</button>
            <button className={signUp ? "auth-tab active" : "auth-tab"} onClick={() => { setSignUp(true); setError(""); setSuccess(""); }}>Create Account</button>
          </div>

          {error && <div className="auth-alert error">{error}</div>}
          {success && <div className="auth-alert success">{success}</div>}

          <button className="google-btn" disabled={loading} onClick={handleGoogle}>
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="auth-divider"><span>or</span></div>

          <form id="authForm" onSubmit={handleSubmit}>
            {signUp && (
              <div className="field-group">
                <label className="field-label" htmlFor="nameInput">Display Name</label>
                <div className="field-wrap">
                  <i className="fas fa-user field-icon"></i>
                  <input type="text" id="nameInput" className="field-input" placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
            )}

            <div className="field-group">
              <label className="field-label" htmlFor="emailInput">Email Address</label>
              <div className="field-wrap">
                <i className="fas fa-envelope field-icon"></i>
                <input type="email" id="emailInput" className="field-input" placeholder="you@example.com" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="passwordInput">Password</label>
                {!signUp && <button type="button" className="forgot-link" onClick={handleForgot}>Forgot password?</button>}
              </div>
              <div className="field-wrap">
                <i className="fas fa-lock field-icon"></i>
                <input type={showPassword ? "text" : "password"} id="passwordInput" className="field-input" placeholder="••••••••" autoComplete={signUp ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="toggle-password" onClick={() => setShowPassword((p) => !p)} aria-label="Toggle password visibility">
                  <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                </button>
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              <span style={{ display: loading ? "none" : "inline" }}>{signUp ? "Create Account" : "Sign In"}</span>
              {loading && <i className="fas fa-circle-notch fa-spin"></i>}
            </button>
          </form>

          <button type="button" className="guest-btn" onClick={() => router.replace("/")}>
            <i className="fas fa-door-open"></i>
            <span>Continue as Guest</span>
          </button>
        </div>
        <p className="auth-footer">By signing in you agree to keep your Foyer account safe.</p>
      </div>
    </>
  );
}

async function ensureUserDoc(user: any, displayName?: string) {
  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        email: user.email || "",
        displayName: displayName || user.displayName || "",
        photoURL: user.photoURL || "",
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("Could not write user doc:", e);
  }
}
